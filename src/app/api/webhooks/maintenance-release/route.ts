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

const TEMPLATE_KEY = "maintenance_back_online";
const BATCH_SIZE = 20;
const MAX_BATCHES = 25;

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

function getReleaseTemplate() {
  const bookingUrl = new URL("/book", getSiteUrl()).toString();

  return {
    subject: "Clean Curb Co. is back online",
    text: [
      "Hey there!",
      "",
      "Clean Curb Co. is back online and our booking system is ready to roll.",
      "",
      "You asked us to let you know once maintenance was finished, so here is your official all-clear:",
      bookingUrl,
      "",
      "Thanks for your patience while we tightened everything up behind the scenes.",
      "",
      "— Clean Curb Co.",
      "Veteran-owned. Hardworking. Weirdly enthusiastic about clean trash cans.",
    ].join("\n"),
    html: `
      <div style="background:#f7f1e7;padding:32px 16px;font-family:Arial,sans-serif;color:#17211b;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:18px;padding:36px;box-shadow:0 10px 30px rgba(0,0,0,.08);">
          <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#47704f;">Clean Curb Co.</p>
          <h1 style="margin:0 0 18px;font-size:30px;line-height:1.15;">We’re back online.</h1>
          <p style="font-size:17px;line-height:1.6;margin:0 0 16px;">Hey there! Our website maintenance is finished and the booking system is ready to roll.</p>
          <p style="font-size:17px;line-height:1.6;margin:0 0 24px;">You asked us to let you know once everything was live again, so here’s your official all-clear.</p>
          <p style="margin:28px 0;">
            <a href="${bookingUrl}" style="display:inline-block;background:#1f4d35;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:10px;">Book Your Cleaning</a>
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 18px;">Thanks for your patience while we tightened everything up behind the scenes.</p>
          <p style="font-size:15px;line-height:1.5;margin:0;color:#526057;">— Clean Curb Co.<br />Veteran-owned. Hardworking. Weirdly enthusiastic about clean trash cans.</p>
        </div>
      </div>
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
    sent,
    failed,
  });

  return NextResponse.json({
    success: true,
    sent,
    failed,
  });
}
