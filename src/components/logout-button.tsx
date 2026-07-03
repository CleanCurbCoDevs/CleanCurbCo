"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useActionFeedback } from "@/components/action-feedback";

export function LogoutButton() {
  const feedback = useActionFeedback();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed.");
      window.location.assign("/login");
    } catch {
      setIsSubmitting(false);
      feedback.error("Could not sign out. Try again.");
    }
  }

  return (
    <button
      className="button button-outline"
      type="button"
      onClick={handleLogout}
      disabled={isSubmitting}
    >
      <LogOut size={18} aria-hidden="true" />
      {isSubmitting ? "Signing Out..." : "Sign Out"}
    </button>
  );
}
