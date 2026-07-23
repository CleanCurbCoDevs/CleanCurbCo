"use client";

import { usePathname } from "next/navigation";
import { SiteFeedbackNudge } from "@/components/site-feedback-nudge";

export function ChromeFrame({
  header,
  footer,
  commercialHeader,
  commercialFooter,
  children,
}: {
  header: React.ReactNode;
  footer: React.ReactNode;
  commercialHeader: React.ReactNode;
  commercialFooter: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hidePublicChrome =
    pathname.startsWith("/field");

  const useCommercialChrome =
    pathname === "/commercial" ||
    pathname.startsWith("/commercial/");

  if (hidePublicChrome) {
    return <>{children}</>;
  }

  return (
    <>
      {useCommercialChrome
        ? commercialHeader
        : header}

      {children}

      {useCommercialChrome
        ? null
        : <SiteFeedbackNudge />}

      {useCommercialChrome
        ? commercialFooter
        : footer}
    </>
  );
}
