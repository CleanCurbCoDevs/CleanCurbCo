"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useActionFeedback } from "@/components/action-feedback";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const feedback = useActionFeedback();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      feedback.success("Copied.");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      feedback.error("Could not copy. Please select and copy manually.");
    }
  }

  return (
    <button
      className="button button-outline"
      type="button"
      onClick={handleCopy}
      disabled={!value}
    >
      <Copy size={16} aria-hidden="true" />
      {copied ? "Copied" : label}
    </button>
  );
}
