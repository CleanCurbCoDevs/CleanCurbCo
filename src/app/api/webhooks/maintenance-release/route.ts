import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { getSiteUrl } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VercelWebhookPayload = {
  type?: string;
  payload?: {
    deployment?: {
      id?: string;
      target?: string | null;
    };
    project?: {
      id?: string;
    };
    target?: string | null;
  };
};

type WaitlistRow = {
  id: string;
  email: string;
};

type PublicPageCheck = {
  path: string;
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  reason: string | null;
};

const TEMPLATE_KEY = "maintenance_back_online";
const BATCH_SIZE = 20;
const MAX_BATCHES = 25;
const LIVE_CHECK_ATTEMPTS = 5;
const LIVE_CHECK_DELAY_MS = 2_000;

function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;

  const expected = createHmac("sha1", secret)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("hex");

  if (signature.length !== expected.length) return false;

  return timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expected, "utf8"),
  );
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getPublicSiteUrl() {
  const url = new URL(getSiteUrl());

  if (url.hostname === "cleancurbco.com") {
    url.hostname = "www.cleancurbco.com";
  }

  return url;
}

async function checkPublicPage(path: string): Promise<PublicPageCheck> {
  const url = new URL(path, getPublicSiteUrl());
  url.searchParams.set("release-check", Date.now().toString());

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
        "User-Agent": "Clean-Curb-Co-Maintenance-Release-Check/1.0",
      },
    });

    const finalUrl = response.url || url.toString();
    const body = (await response.text()).toLowerCase();
    const looksLikeMaintenance =
      finalUrl.includes("/maintenance") ||
      body.includes("maintenance mode") ||
      body.includes("we’re cleaning things up") ||
      body.includes("we're cleaning things up") ||
      body.includes("website is getting a quick rinse");

    if (!response.ok) {
      return {
        path,
        ok: false,
        status: response.status,
        finalUrl,
        reason: `Public page returned HTTP ${response.status}.`,
      };
    }

    if (looksLikeMaintenance) {
      return {
        path,
        ok: false,
        status: response.status,
        finalUrl,
        reason: "Public page still appears to be in maintenance mode.",
      };
    }

    return {
      path,
      ok: true,
      status: response.status,
      finalUrl,
      reason: null,
    };
  } catch (error) {
    return {
      path,
      ok: false,
      status: null,
      finalUrl: null,
      reason:
        error instanceof Error
          ? error.message
          : "Unknown public-page check failure.",
    };
  }
}

async function waitForPublicSite() {
  let checks: PublicPageCheck[] = [];

  for (let attempt = 1; attempt <= LIVE_CHECK_ATTEMPTS; attempt += 1) {
    checks = await Promise.all([
      checkPublicPage("/"),
      checkPublicPage("/book"),
    ]);

    if (checks.every((check) => check.ok)) {
      return { live: true, attempt, checks };
    }

    if (attempt < LIVE_CHECK_ATTEMPTS) {
      await delay(LIVE_CHECK_DELAY_MS);
    }
  }

  return {
    live: false,
    attempt: LIVE_CHECK_ATTEMPTS,
    checks,
  };
}

function getReleaseTemplate() {
  const siteUrl = getPublicSiteUrl();
  const bookingUrl = new URL("/book", siteUrl);
  const logoUrl = new URL("/clean-curb-logo.png", siteUrl);
  const releaseId = Date.now().toString();

  bookingUrl.searchParams.set("back-online", releaseId);

  return {
    subject: "We’re back, baby! Clean Curb Co. is online",
    text: [
      "We’re back, baby!",
      "",
      "The website is officially back online, the digital trash fire has been extinguished, and you can now get back to booking the actual trash-related stuff.",
      "",
      "Thanks for hanging in there while we cleaned things up behind the scenes. Everything should now be working normally, but if you find something acting weird, please tell us. We are very good at cleaning garbage cans. Websites occasionally require a second rinse.",
      "",
      "Ready to get those bins handled?",
      "",
      `Book Your Cleaning: ${bookingUrl.toString()}`,
      "",
      "Thanks for supporting a local, veteran-owned small business. We genuinely appreciate every booking, referral, and person willing to trust us with the gross stuff.",
      "",
      "Stay fresh,",
      "The Clean Curb Co. Team",
      "Fresh Starts at the Curb.",
      "",
      "Need help? Reply to this email or contact contact@cleancurbco.com.",
    ].join("\n"),
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>We’re back, baby!</title>
        </head>
        <body style="margin:0;padding:0;background:#050505;color:#171d19;font-family:Arial,Helvetica,sans-serif;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            The digital trash fire has been extinguished. Clean Curb Co. is back online.
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#050505;">
            <tr>
              <td align="center" style="padding:34px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;">
                  <tr>
                    <td align="center" style="padding:0 0 18px;">
                      <img src="${logoUrl.toString()}" width="92" height="92" alt="Clean Curb Co." style="display:block;width:92px;height:92px;border:0;border-radius:18px;" />
                    </td>
                  </tr>

                  <tr>
                    <td style="background:#f4ecdd;border:1px solid #2f3b33;border-radius:24px;overflow:hidden;box-shadow:0 18px 55px rgba(0,0,0,.36);">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="height:8px;background:#63d471;font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="padding:38px 38px 16px;">
                            <div style="display:inline-block;background:#d9f7dd;border:1px solid #9edca7;border-radius:999px;padding:7px 12px;color:#174c25;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">
                              We’re live
                            </div>

                            <h1 style="margin:20px 0 18px;color:#0b0d0c;font-size:38px;line-height:1.08;letter-spacing:-.03em;">
                              We’re back, baby!
                            </h1>

                            <p style="margin:0 0 18px;color:#27312b;font-size:17px;line-height:1.7;">
                              The website is officially back online, the digital trash fire has been extinguished, and you can now get back to booking the actual trash-related stuff.
                            </p>

                            <p style="margin:0 0 18px;color:#27312b;font-size:17px;line-height:1.7;">
                              Thanks for hanging in there while we cleaned things up behind the scenes. Everything should now be working normally, but if you find something acting weird, please tell us.
                            </p>

                            <div style="margin:24px 0;padding:18px 20px;background:#ffffff;border:1px solid #ddd2c1;border-radius:16px;color:#28322c;font-size:16px;line-height:1.65;">
                              We are very good at cleaning garbage cans. Websites occasionally require a second rinse.
                            </div>

                            <p style="margin:0 0 22px;color:#111512;font-size:18px;font-weight:700;line-height:1.5;">
                              Ready to get those bins handled?
                            </p>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;">
                              <tr>
                                <td bgcolor="#58cf68" style="border-radius:12px;">
                                  <a href="${bookingUrl.toString()}" style="display:inline-block;padding:15px 24px;color:#071209;text-decoration:none;font-size:16px;font-weight:800;line-height:1;border-radius:12px;">
                                    Book Your Cleaning
                                  </a>
                                </td>
                              </tr>
                            </table>

                            <p style="margin:0 0 28px;color:#657067;font-size:12px;line-height:1.55;word-break:break-all;">
                              Button acting weird? Copy this link:<br />
                              <a href="${bookingUrl.toString()}" style="color:#245d31;text-decoration:underline;">${bookingUrl.toString()}</a>
                            </p>

                            <p style="margin:0 0 18px;color:#27312b;font-size:16px;line-height:1.7;">
                              Thanks for supporting a local, veteran-owned small business. We genuinely appreciate every booking, referral, and person willing to trust us with the gross stuff.
                            </p>

                            <p style="margin:0;color:#171d19;font-size:16px;line-height:1.65;">
                              Stay fresh,<br />
                              <strong>The Clean Curb Co. Team</strong><br />
                              <em style="color:#477051;">Fresh Starts at the Curb.</em>
                            </p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding:24px 38px 34px;">
                            <div style="border-top:1px solid #d8cdbd;padding-top:20px;color:#697269;font-size:12px;line-height:1.7;">
                              Need help? Reply to this email or
                              <a href="mailto:contact@cleancurbco.com" style="color:#245d31;text-decoration:underline;">contact us</a>.<br />
                              <a href="${siteUrl.toString()}" style="color:#245d31;text-decoration:underline;">cleancurbco.com</a><br />
                              Clean Curb Co. is operated by Stonebranch Capital LLC.
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:18px 12px 0;color:#aab0ab;font-size:11px;line-height:1.6;">
                      Local. Veteran-owned. Weirdly enthusiastic about clean trash cans.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

async function sendReleaseEmail(row: WaitlistRow) {
  // Cast is intentional until the two new columns are added to Database.
  const admin = getSupabaseAdmin() as any;
  const template = getReleaseTemplate();

  const result = await sendTransactionalEmail({
    to: row.email,
    ...template,
    templateKey: TEMPLATE_KEY,
    idempotencyKey: `maintenance-back-online-${row.id}`,
  });

  if (result.status === "sent") {
    const { error } = await admin
      .from("maintenance_waitlist")
      .update({
        notified_at: new Date().toISOString(),
        notification_error: null,
      })
      .eq("id", row.id)
      .is("notified_at", null);

    if (error) {
      console.error("maintenance_release_mark_sent_failed", {
        waitlistId: row.id,
        message: error.message,
      });
    }

    return { sent: true };
  }

  const reason =
    "reason" in result && result.reason
      ? result.reason
      : "error" in result && result.error
        ? String(result.error)
        : "Unknown email failure";

  await admin
    .from("maintenance_waitlist")
    .update({
      notification_error: reason.slice(0, 1000),
    })
    .eq("id", row.id);

  return { sent: false };
}

export async function POST(request: Request) {
  const secret =
    process.env.MAINTENANCE_RELEASE_WEBHOOK_SECRET ?? "";

  if (!secret) {
    console.error("maintenance_release_secret_missing");

    return NextResponse.json(
      { error: "Webhook secret is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-vercel-signature");

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 403 },
    );
  }

  let event: VercelWebhookPayload;

  try {
    event = JSON.parse(rawBody) as VercelWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  if (
    event.type !== "deployment.promoted" &&
    event.type !== "deployment.ready" &&
    event.type !== "deployment.succeeded"
  ) {
    return NextResponse.json({
      ignored: true,
      reason: "Not a successful deployment.",
    });
  }

  const target =
    event.payload?.target ??
    event.payload?.deployment?.target ??
    null;

  if (target && target !== "production") {
    return NextResponse.json({
      ignored: true,
      reason: "Not a production deployment.",
    });
  }

  const expectedProjectId = process.env.VERCEL_PROJECT_ID;
  const eventProjectId = event.payload?.project?.id;

  if (
    expectedProjectId &&
    eventProjectId &&
    eventProjectId !== expectedProjectId
  ) {
    return NextResponse.json({
      ignored: true,
      reason: "Wrong Vercel project.",
    });
  }

  if (process.env.MAINTENANCE_MODE === "true") {
    return NextResponse.json({
      ignored: true,
      reason: "Maintenance mode is still enabled.",
    });
  }

  const publicSite = await waitForPublicSite();

  if (!publicSite.live) {
    console.error("maintenance_release_public_site_not_ready", {
      attempts: publicSite.attempt,
      checks: publicSite.checks,
    });

    return NextResponse.json(
      {
        error: "The public site is not ready yet.",
        checks: publicSite.checks,
      },
      { status: 503 },
    );
  }

  const admin = getSupabaseAdmin() as any;
  let sent = 0;
  let failed = 0;

  for (
    let batchNumber = 0;
    batchNumber < MAX_BATCHES;
    batchNumber += 1
  ) {
    const { data, error } = await admin
      .from("maintenance_waitlist")
      .select("id,email")
      .is("notified_at", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error(
        "maintenance_release_waitlist_read_failed",
        { message: error.message },
      );

      return NextResponse.json(
        { error: "Could not read the maintenance waitlist." },
        { status: 500 },
      );
    }

    const rows = (data ?? []) as WaitlistRow[];
    if (!rows.length) break;

    const results = await Promise.all(
      rows.map(sendReleaseEmail),
    );

    for (const result of results) {
      if (result.sent) sent += 1;
      else failed += 1;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  console.info("maintenance_release_completed", {
    deploymentId:
      event.payload?.deployment?.id ?? null,
    publicSiteChecks: publicSite.checks,
    sent,
    failed,
  });

  return NextResponse.json({
    success: true,
    sent,
    failed,
  });
}
