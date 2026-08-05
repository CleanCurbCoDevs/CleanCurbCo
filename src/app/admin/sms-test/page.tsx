import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/shells/admin-shell";
import { sendTransactionalSms } from "@/lib/sms/twilio";
import { requireAdmin } from "@/lib/supabase/auth";
import {
  cleanString,
  isValidPhone,
} from "@/lib/validation";

export const metadata: Metadata = {
  title: "SMS Diagnostics",
  description:
    "Clean Curb Co. outbound SMS diagnostic tool.",
};

const TEST_MESSAGE =
  "Clean Curb Co.: SMS system test successful. Msg & data rates may apply. Reply HELP for help or STOP to cancel. Support: 843-888-4124.";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
};

async function sendSmsDiagnostic(
  formData: FormData,
) {
  "use server";

  const auth = await requireAdmin(
    "/admin/sms-test",
  );

  if (auth.status !== "ok") {
    redirect("/admin");
  }

  const phone = cleanString(
    formData.get("phone"),
    40,
  );

  const consentConfirmed =
    formData.get("consentConfirmed") ===
    "on";

  if (!isValidPhone(phone)) {
    const params = new URLSearchParams({
      status: "failed",
      message:
        "Enter a valid phone number.",
    });

    redirect(
      `/admin/sms-test?${params.toString()}`,
    );
  }

  if (!consentConfirmed) {
    const params = new URLSearchParams({
      status: "failed",
      message:
        "Confirm that you control the test number and consent to receive the diagnostic text.",
    });

    redirect(
      `/admin/sms-test?${params.toString()}`,
    );
  }

  const result =
    await sendTransactionalSms({
      to: phone,
      body: TEST_MESSAGE,
      templateKey: "sms_diagnostic",
      consentGranted: true,
      recipientProfileId: auth.userId,
    });

  let message: string;

  if (result.status === "queued") {
    message =
      `Twilio accepted the test message. Message SID: ${result.sid}`;
  } else if (result.status === "failed") {
    message =
      `Twilio rejected the test message: ${result.error}`;
  } else {
    message =
      `The test message was skipped: ${result.reason}`;
  }

  const params = new URLSearchParams({
    status: result.status,
    message,
  });

  redirect(
    `/admin/sms-test?${params.toString()}`,
  );
}

export default async function SmsTestPage({
  searchParams,
}: PageProps) {
  const auth = await requireAdmin(
    "/admin/sms-test",
  );

  const params = await searchParams;

  return (
    <AdminShell
      title="SMS diagnostics"
      auth={auth}
    >
      <section className="placeholder-panel">
        <div className="admin-page-heading">
          <div>
            <p className="section-kicker">
              Twilio Test
            </p>

            <h1>
              Send one controlled test text.
            </h1>

            <p className="muted">
              This uses the production Clean
              Curb Co. sender, delivery
              callback, suppression list, and
              notification log.
            </p>
          </div>

          <Link href="/admin">
            Back to admin
          </Link>
        </div>

        {params.message ? (
          <p
            role="status"
            className="status-badge"
            style={{
              display: "block",
              marginBottom: "1.5rem",
              whiteSpace: "normal",
            }}
          >
            {params.message}
          </p>
        ) : null}

        <form
          action={sendSmsDiagnostic}
          style={{
            display: "grid",
            gap: "1.25rem",
            maxWidth: "640px",
          }}
        >
          <label
            style={{
              display: "grid",
              gap: "0.5rem",
            }}
          >
            <strong>
              Test phone number
            </strong>

            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="843-555-1234"
              required
            />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
            }}
          >
            <input
              name="consentConfirmed"
              type="checkbox"
              required
            />

            <span>
              I control this phone number
              and consent to receive this
              diagnostic message.
            </span>
          </label>

          <div>
            <button type="submit">
              Send diagnostic text
            </button>
          </div>
        </form>

        <hr
          style={{
            margin: "2rem 0",
          }}
        />

        <div>
          <p className="section-kicker">
            Fixed test message
          </p>

          <p>{TEST_MESSAGE}</p>
        </div>
      </section>
    </AdminShell>
  );
}
