import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  isRecoverableSupabaseSessionError,
} from "@/lib/supabase/auth-errors";

const ALWAYS_AVAILABLE_ROUTES = [
  "/maintenance",
  "/contact",
  "/login",
  "/field/login",
  "/reset-password",
  "/update-password",
  "/auth",
  "/api/auth",
  "/api/contact",
  "/api/maintenance-signup",
];

function isAlwaysAvailable(
  pathname: string,
) {
  return ALWAYS_AVAILABLE_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(
        `${route}/`,
      ),
  );
}

function isStaticAsset(
  pathname: string,
) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function isSupabaseAuthCookie(
  name: string,
) {
  return (
    name.startsWith("sb-") &&
    name.includes("-auth-token")
  );
}

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
) {
  request.cookies
    .getAll()
    .filter((cookie) =>
      isSupabaseAuthCookie(cookie.name),
    )
    .forEach((cookie) => {
      request.cookies.set(
        cookie.name,
        "",
      );

      response.cookies.set(
        cookie.name,
        "",
        {
          expires: new Date(0),
          maxAge: 0,
          path: "/",
          sameSite: "lax",
        },
      );
    });
}

function copyResponseCookies(
  source: NextResponse,
  target: NextResponse,
) {
  source.cookies
    .getAll()
    .forEach((cookie) => {
      target.cookies.set(
        cookie.name,
        cookie.value,
        cookie,
      );
    });
}

export async function proxy(
  request: NextRequest,
) {
  const maintenanceEnabled =
    process.env.MAINTENANCE_MODE ===
    "true";

  const pathname =
    request.nextUrl.pathname;

  let response =
    NextResponse.next({
      request,
    });

  let authenticatedUserId:
    | string
    | null = null;

  let authenticatedRole:
    | string
    | null = null;

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL ??
    "";

  const supabaseAnonKey =
    process.env
      .NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";

  if (
    supabaseUrl &&
    supabaseAnonKey
  ) {
    const supabase =
      createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },

            setAll(cookiesToSet) {
              cookiesToSet.forEach(
                ({
                  name,
                  value,
                }) => {
                  request.cookies.set(
                    name,
                    value,
                  );
                },
              );

              response =
                NextResponse.next({
                  request,
                });

              cookiesToSet.forEach(
                ({
                  name,
                  value,
                  options,
                }) => {
                  response.cookies.set(
                    name,
                    value,
                    options,
                  );
                },
              );
            },
          },
        },
      );

    try {
      const {
        data: { user },
        error,
      } =
        await supabase.auth.getUser();

      if (error) {
        if (
          isRecoverableSupabaseSessionError(
            error,
          )
        ) {
          clearSupabaseAuthCookies(
            request,
            response,
          );
        }
      } else {
        authenticatedUserId =
          user?.id ?? null;
      }
    } catch (error) {
      if (
        isRecoverableSupabaseSessionError(
          error,
        )
      ) {
        clearSupabaseAuthCookies(
          request,
          response,
        );
      }
    }

    if (
      maintenanceEnabled &&
      authenticatedUserId
    ) {
      const {
        data: profile,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq(
          "id",
          authenticatedUserId,
        )
        .maybeSingle();

      authenticatedRole =
        profile?.role ?? null;
    }
  }

  if (!maintenanceEnabled) {
    return response;
  }

  if (
    isAlwaysAvailable(pathname) ||
    isStaticAsset(pathname)
  ) {
    return response;
  }

  if (
    authenticatedRole === "owner" ||
    authenticatedRole === "admin"
  ) {
    return response;
  }

  const maintenanceUrl =
    request.nextUrl.clone();

  maintenanceUrl.pathname =
    "/maintenance";

  maintenanceUrl.search = "";

  const redirectResponse =
    NextResponse.redirect(
      maintenanceUrl,
    );

  copyResponseCookies(
    response,
    redirectResponse,
  );

  return redirectResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
