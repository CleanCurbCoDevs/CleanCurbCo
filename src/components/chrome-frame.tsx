"use client";

import { usePathname } from "next/navigation";
import { SiteFeedbackNudge } from "@/components/site-feedback-nudge";

export function ChromeFrame({
  header,
  footer,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hidePublicChrome = pathname.startsWith("/field");

  return (
    <>
      {hidePublicChrome ? null : header}
      {children}
      {hidePublicChrome ? null : <SiteFeedbackNudge />}
      {hidePublicChrome ? null : footer}
    </>
  );
}
