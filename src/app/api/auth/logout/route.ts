import {
  cookies,
} from "next/headers";

import {
  NextResponse,
} from "next/server";

import {
  isSupabaseConfigured,
} from "@/lib/env";

import {
  rejectCrossOriginRequest,
} from "@/lib/server/request-guards";

import {
  createRequestId,
  logger,
} from "@/lib/server/logger";

import {
  isRecoverableSupabaseSessionError,
} from "@/lib/supabase/auth-errors";

import {
  createServerSupabaseClient,
} from "@/lib/supabase/server";

function isSupabaseAuthCookie(
  name: string,
) {
  return (
    name.startsWith("sb-") &&
    name.includes("-auth-token")
  );
}

async function clearAuthCookies() {
  const cookieStore =
    await cookies();

  cookieStore
    .getAll()
    .filter((cookie) =>
      isSupabaseAuthCookie(cookie.name),
    )
    .forEach((cookie) => {
      cookieStore.set(
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

export async function POST(
  request: Request,
) {
  const requestId =
    createRequestId(
      request.headers,
    );

  const route =
    "/api/auth/logout";

  const originRejection =
    rejectCrossOriginRequest(
      request,
      {
        requestId,
        route,
        action: "auth_logout",
      },
    );

  if (originRejection) {
    return originRejection;
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase =
        await createServerSupabaseClient();

      const { error } =
        await supabase.auth.signOut();

      if (
        error &&
        !isRecoverableSupabaseSessionError(
          error,
        )
      ) {
        logger.warn(
          "auth_logout_provider_failed",
          {
            requestId,
            route,
            action: "auth_logout",
            error,
          },
        );
      }
    } catch (error) {
      if (
        !isRecoverableSupabaseSessionError(
          error,
        )
      ) {
        logger.warn(
          "auth_logout_provider_failed",
          {
            requestId,
            route,
            action: "auth_logout",
            error,
          },
        );
      }
    }
  }

  await clearAuthCookies();

  logger.info("auth_logout", {
    requestId,
    route,
  });

  return NextResponse.json({
    redirectTo: "/login",
    requestId,
  });
}
