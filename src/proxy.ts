import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

const ALWAYS_AVAILABLE_ROUTES = [
  "/maintenance",
  "/contact",
  "/login",
  "/reset-password",
  "/update-password",
  "/auth",
  "/api/auth",
  "/api/contact",
  "/api/maintenance-signup",
];

function isAlwaysAvailable(pathname: string) {
  return ALWAYS_AVAILABLE_ROUTES.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`),
  );
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

export async function proxy(
  request: NextRequest,
) {
  const maintenanceEnabled =
    process.env.MAINTENANCE_MODE === "true";

  if (!maintenanceEnabled) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  if (
    isAlwaysAvailable(pathname) ||
    isStaticAsset(pathname)
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            cookiesToSet.forEach(
              ({ name, value }) => {
                request.cookies.set(name, value);
              },
            );

            response = NextResponse.next({
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = profile?.role;

      if (
        role === "owner" ||
        role === "admin"
      ) {
        return response;
      }
    }
  }

  const maintenanceUrl =
    request.nextUrl.clone();

  maintenanceUrl.pathname = "/maintenance";

  // Do not carry booking/payment query strings
  // onto the maintenance page.
  maintenanceUrl.search = "";

  return NextResponse.redirect(
    maintenanceUrl,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
