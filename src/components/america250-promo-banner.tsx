"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  america250Promotion,
  isAmerica250PromoActive,
} from "@/lib/promotions";
import { getLaunchStatusCopy } from "@/lib/launch-status";

export function America250PromoBanner() {
  const pathname = usePathname();
  const [promoActive, setPromoActive] = useState(false);
  const [siteNotice, setSiteNotice] = useState(() => getLaunchStatusCopy().notice);

  useEffect(() => {
    function updatePromoState() {
      setPromoActive(isAmerica250PromoActive());
      setSiteNotice(getLaunchStatusCopy().notice);
    }

    updatePromoState();
    const interval = window.setInterval(updatePromoState, 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  if (pathname.startsWith("/admin") || pathname.startsWith("/field")) {
    return null;
  }

  if (!promoActive) {
    return (
      <Link className="announcement-bar" href="/book">
        <span>{siteNotice}</span>
      </Link>
    );
  }

  return (
    <div className="america250-announcement-bar">
      <Link className="america250-announcement-main" href={america250Promotion.bookingHref}>
        <strong>{america250Promotion.name}</strong>
        <span>
          Save {america250Promotion.discountPercent}% on eligible recurring
          service — stacks with the Founding Neighbor Special.
        </span>
      </Link>

      <Link
        className="america250-announcement-learn"
        href={america250Promotion.detailsHref}
      >
        Learn More
      </Link>
    </div>
  );
}