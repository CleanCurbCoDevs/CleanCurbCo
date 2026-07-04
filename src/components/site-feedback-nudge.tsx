"use client";

import { MessageSquareText } from "lucide-react";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/site";

type SiteFeedbackNudgeProps = {
  variant?: "footer" | "inline";
  context?: string;
};

const hiddenFooterPrefixes = [
  "/admin",
  "/field",
  "/employee-login",
  "/payment-setup",
  "/account-setup",
  "/reset-password",
  "/portal",
  "/billing",
];

export function SiteFeedbackNudge({
  variant = "footer",
  context,
}: SiteFeedbackNudgeProps) {
  const pathname = usePathname();

  if (
    variant === "footer" &&
    (pathname === "/book" ||
      hiddenFooterPrefixes.some((prefix) => pathname.startsWith(prefix)))
  ) {
    return null;
  }

  const feedbackContext = context ?? pathname;
  const subject = encodeURIComponent("Website feedback for Clean Curb Co.");
  const body = encodeURIComponent(
    [
      `Page / context: ${feedbackContext}`,
      "",
      "What did you like?",
      "",
      "What did you dislike?",
      "",
      "What should we fix, add, remove, or explain better?",
      "",
      "Be honest. We can take it, trust me.",
    ].join("\n"),
  );

  const feedbackHref = `mailto:${brand.email}?subject=${subject}&body=${body}`;

  return (
    <aside
      className={
        variant === "inline"
          ? "site-feedback-nudge site-feedback-inline"
          : "site-feedback-nudge"
      }
    >
      <div className="site-feedback-icon">
        <MessageSquareText size={20} aria-hidden="true" />
      </div>

      <div>
        <p className="section-kicker">Tiny favor?</p>
        <h2>Help us make the website less weird.</h2>
        <p>
          Like something? Hate something? Confused by something? Tell us. We are
          actively cleaning this place up too.
        </p>
      </div>

      <a className="button button-dark" href={feedbackHref}>
        Send Feedback
      </a>
    </aside>
  );
}