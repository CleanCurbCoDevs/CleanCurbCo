"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const effectSelector = [
  ".page-hero",
  ".hero-content",
  ".section-header",
  ".section > .container",
  ".card",
  ".pricing-card",
  ".service-card",
  ".launch-info-card",
  ".placeholder-panel",
  ".detail-panel",
  ".contact-choice-card",
  ".promo-terms-card",
  ".proof-gallery",
  ".proof-photo-card",
  ".route-status-card",
  ".billing-note-card",
  ".final-cta .container",
].join(",");

const bookCtaSelector = [
  'a[href="/book"]',
  'a[href^="/book?"]',
  'a[href*="cleancurbco.com/book"]',
  'button[type="submit"]',
].join(",");

export function PublicPageEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/field") ||
      pathname.startsWith("/employee-login")
    ) {
      return;
    }

    const isMobile = window.matchMedia("(max-width: 719px)").matches;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (isMobile || prefersReducedMotion) {
      document.documentElement.classList.remove("page-effects-mounted");
      document.documentElement.classList.add("effects-reduced-motion");

      document
        .querySelectorAll<HTMLElement>(effectSelector)
        .forEach((element) => {
          element.classList.remove("scroll-fade-item", "is-visible");
        });

      return;
    }

    document.documentElement.classList.remove("effects-reduced-motion");
    document.documentElement.classList.add("page-effects-mounted");

    const disableScrollFade = pathname === "/book";
    
    const revealElements = disableScrollFade
      ? []
      : Array.from(
          document.querySelectorAll<HTMLElement>(effectSelector),
        );

    revealElements.forEach((element) => {
      element.classList.add("scroll-fade-item");
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement;

          if (entry.isIntersecting) {
            element.classList.add("is-visible");
          } else {
            element.classList.remove("is-visible");
          }
        });
      },
      {
        root: null,
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    const bookButtons = Array.from(
      document.querySelectorAll<HTMLElement>(bookCtaSelector),
    ).filter((element) => {
      const text = element.textContent?.toLowerCase() ?? "";
      return (
        text.includes("book") ||
        text.includes("request") ||
        text.includes("join")
      );
    });

    bookButtons.forEach((button) => {
      button.classList.add("book-cta-pop");
    });

    const bounceTimer = window.setTimeout(() => {
      bookButtons.forEach((button) => {
        button.classList.remove("book-cta-pop");
      });
    }, 2800);

    return () => {
      window.clearTimeout(bounceTimer);
      observer.disconnect();

      revealElements.forEach((element) => {
        element.classList.remove("scroll-fade-item", "is-visible");
      });

      bookButtons.forEach((button) => {
        button.classList.remove("book-cta-pop");
      });
    };
  }, [pathname]);

  return null;
}
