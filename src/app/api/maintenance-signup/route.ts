import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type SignupPayload = {
  email?: unknown;
  website?: unknown;
};

function normalizeEmail(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().slice(0, 160)
    : "";
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let payload: SignupPayload;

  try {
    payload = (await request.json()) as SignupPayload;
  } catch {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  // Honeypot field for basic spam protection.
  if (typeof payload.website === "string" && payload.website.trim()) {
    return NextResponse.json({ success: true });
  }

  const email = normalizeEmail(payload.email);

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from("maintenance_waitlist")
      .upsert(
        {
          email,
          source: "maintenance_page",
        },
        {
          onConflict: "email",
          ignoreDuplicates: true,
        },
      );

    if (error) {
      console.error("Maintenance signup failed:", error);

      return NextResponse.json(
        {
          error:
            "We could not save your email right now. Please contact us directly.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Maintenance signup error:", error);

    return NextResponse.json(
      {
        error:
          "We could not save your email right now. Please contact us directly.",
      },
      { status: 500 },
    );
  }
}
