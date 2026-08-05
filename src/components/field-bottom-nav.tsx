"use client";

import {
  CalendarDays,
  Clock3,
  History,
  LogOut,
  MapPinned,
} from "lucide-react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  type FormEvent,
  useState,
} from "react";

import {
  useActionFeedback,
} from "@/components/action-feedback";

import pressableStyles from "./pressable.module.css";

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
  const feedback =
    useActionFeedback();

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  async function handleLogout(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Logout failed.",
        );
      }

      window.location.assign(
        "/field/login",
      );
    } catch {
      setIsLoggingOut(false);

      feedback.error(
        "Could not sign out. Try again.",
      );
    }
  }

  return (
    <nav
      className="field-bottom-nav"
      aria-label="Field application navigation"
    >
      {fieldLinks.map((link) => {
        const Icon = link.icon;

        const isActive =
          pathname === link.href ||
          pathname.startsWith(
            `${link.href}/`,
          );

        return (
          <Link
            className={
              isActive
                ? "field-nav-active"
                : undefined
            }
            href={link.href}
            key={link.href}
            aria-current={
              isActive
                ? "page"
                : undefined
            }
          >
            <Icon
              size={21}
              aria-hidden="true"
            />

            <span>{link.label}</span>
          </Link>
        );
      })}

      <form onSubmit={handleLogout}>
        <button
          aria-busy={isLoggingOut}
          className={
            pressableStyles.pressable
          }
          data-pending={
            isLoggingOut
              ? "true"
              : "false"
          }
          disabled={isLoggingOut}
          type="submit"
        >
          <LogOut
            size={21}
            aria-hidden="true"
          />

          <span>
            {isLoggingOut
              ? "Signing Out"
              : "Logout"}
          </span>
        </button>
      </form>
    </nav>
  );
}
