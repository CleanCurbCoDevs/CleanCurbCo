"use client";

import {
  CalendarDays,
  Clock3,
  History,
  LogOut,
  MapPinned,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const fieldLinks = [
  {
    label: "Today",
    href: "/field/today",
    icon: CalendarDays,
  },
  {
    label: "Routes",
    href: "/field/routes",
    icon: MapPinned,
  },
  {
    label: "Breaks",
    href: "/field/breaks",
    icon: Clock3,
  },
  {
    label: "History",
    href: "/field/history",
    icon: History,
  },
];

export function FieldBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="field-bottom-nav"
      aria-label="Field application navigation"
    >
      {fieldLinks.map((link) => {
        const Icon = link.icon;

        const isActive =
          pathname === link.href ||
          pathname.startsWith(`${link.href}/`);

        return (
          <Link
            className={isActive ? "field-nav-active" : undefined}
            href={link.href}
            key={link.href}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{link.label}</span>
          </Link>
        );
      })}

      <form action="/auth/signout" method="post">
        <button type="submit">
          <LogOut size={21} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </form>
    </nav>
  );
}