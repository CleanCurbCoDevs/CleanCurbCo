import {
  NextResponse,
  type NextRequest,
} from "next/server";

const CLOSED_MESSAGE =
  "Clean Curb Co. has discontinued operations.";

const CLOSED_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <meta name="robots" content="noindex, nofollow, noarchive" />
    <title>Clean Curb Co. — Operations Discontinued</title>

    <style>
      :root {
        color-scheme: dark;
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
        margin: 0;
      }

      body {
        display: grid;
        place-items: center;
        min-height: 100vh;
        padding: 24px;
        color: #f7f7f7;
        background:
          radial-gradient(
            circle at top left,
            rgba(111, 60, 195, 0.3),
            transparent 38%
          ),
          radial-gradient(
            circle at bottom right,
            rgba(28, 168, 112, 0.24),
            transparent 40%
          ),
          #080808;
      }

      main {
        width: min(100%, 720px);
      }

      .card {
        position: relative;
        overflow: hidden;
        padding: clamp(30px, 6vw, 58px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 28px;
        background: rgba(15, 15, 15, 0.94);
        box-shadow:
          0 26px 80px rgba(0, 0, 0, 0.55),
          inset 0 1px rgba(255, 255, 255, 0.06);
      }

      .accent {
        position: absolute;
        inset: 0 0 auto;
        height: 7px;
        background: linear-gradient(
          90deg,
          #1ca870 0 34%,
          #f2c94c 34% 66%,
          #6f3cc3 66% 100%
        );
      }

      .brand {
        margin: 0 0 30px;
        color: #f2c94c;
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      h1 {
        max-width: 620px;
        margin: 0;
        font-size: clamp(2.2rem, 7vw, 4.4rem);
        line-height: 0.98;
        letter-spacing: -0.055em;
      }

      .lead {
        margin: 28px 0 0;
        color: #f0f0f0;
        font-size: clamp(1.08rem, 2.5vw, 1.28rem);
        line-height: 1.65;
      }

      p {
        color: #bdbdbd;
        font-size: 1rem;
        line-height: 1.7;
      }

      .notice {
        margin-top: 30px;
        padding: 20px;
        border-left: 4px solid #1ca870;
        border-radius: 4px 14px 14px 4px;
        background: rgba(28, 168, 112, 0.09);
      }

      .notice p {
        margin: 0;
        color: #dedede;
      }

      footer {
        margin-top: 34px;
        padding-top: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        color: #858585;
        font-size: 0.86rem;
        line-height: 1.6;
      }

      strong {
        color: #ffffff;
      }
    </style>
  </head>

  <body>
    <main>
      <section class="card">
        <div class="accent" aria-hidden="true"></div>

        <p class="brand">Clean Curb Co.</p>

        <h1>Operations have been discontinued.</h1>

        <p class="lead">
          Stonebranch Capital LLC has decided to discontinue
          and formally wind down all operations conducted
          under the Clean Curb Co. name.
        </p>

        <p>
          Clean Curb Co. is no longer accepting bookings,
          payments, service requests, or account access.
          This closure applies to all customer, employee,
          field, and administrative systems.
        </p>

        <div class="notice">
          <p>
            Anyone expecting a refund should monitor the
            email address previously associated with their
            account for confirmation from Clean Curb Co.
          </p>
        </div>

        <p>
          We sincerely apologize for the inconvenience and
          appreciate everyone who supported the business.
        </p>

        <footer>
          Clean Curb Co. was operated by
          <strong>Stonebranch Capital LLC</strong>.
        </footer>
      </section>
    </main>
  </body>
</html>`;

function closedApiResponse() {
  return NextResponse.json(
    {
      error: CLOSED_MESSAGE,
      status: 410,
    },
    {
      status: 410,
      headers: {
        "Cache-Control":
          "no-store, max-age=0, must-revalidate",
        "X-Robots-Tag":
          "noindex, nofollow, noarchive",
      },
    },
  );
}

export function proxy(
  request: NextRequest,
) {
  const pathname =
    request.nextUrl.pathname;

  if (pathname === "/robots.txt") {
    return new NextResponse(
      "User-agent: *\nDisallow: /\n",
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (
    pathname.startsWith("/api/") ||
    !["GET", "HEAD"].includes(
      request.method,
    )
  ) {
    return closedApiResponse();
  }

  return new NextResponse(
    CLOSED_HTML,
    {
      status: 410,
      headers: {
        "Content-Type":
          "text/html; charset=utf-8",
        "Cache-Control":
          "no-store, max-age=0, must-revalidate",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        "Referrer-Policy":
          "no-referrer",
        "X-Content-Type-Options":
          "nosniff",
        "X-Frame-Options":
          "DENY",
        "X-Robots-Tag":
          "noindex, nofollow, noarchive",
      },
    },
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
