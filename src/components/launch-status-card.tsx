"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLaunchStatusCopy } from "@/lib/launch-status";

export function LaunchStatusCard({
  variant = "hero",
  className,
  showButton = false,
}: {
  variant?: "hero" | "card";
  className?: string;
  showButton?: boolean;
}) {
  const [copy, setCopy] = useState(() => getLaunchStatusCopy());

  useEffect(() => {
    function updateCopy() {
      setCopy(getLaunchStatusCopy());
    }

    updateCopy();
    const interval = window.setInterval(updateCopy, 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  if (variant === "card") {
    return (
      <article className={className ?? "launch-info-card"}>
        <p className="section-kicker">{copy.kicker}</p>
        <h2>{copy.headline}</h2>
        <p>{copy.body}</p>
        {showButton ? (
          <Link className="button button-dark" href="/book">
            Book Now
          </Link>
        ) : null}
      </article>
    );
  }

  return (
    <div className={className ?? "hero-launch-note"}>
      <strong>{copy.headline}</strong>
      <span>{copy.body}</span>
    </div>
  );
}