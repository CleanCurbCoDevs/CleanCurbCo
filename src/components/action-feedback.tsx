"use client";

import {
  createContext,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: string;
  tone: ToastTone;
  message: string;
};

type FeedbackContextValue = {
  notify: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const FormFeedbackContext = createContext<{
  pending: boolean;
} | null>(null);

type FeedbackFormProps = {
  action: (formData: FormData) => Promise<ActionResult | void>;
  children: ReactNode;
  className?: string;
  confirmMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  pendingMessage?: string;
  resetOnSuccess?: boolean;
  successMessage: string;
};

type ActionSubmitButtonProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  formAction?: ButtonHTMLAttributes<HTMLButtonElement>["formAction"];
  name?: string;
  pendingLabel?: string;
  type?: "button" | "submit";
  value?: string;
};

type InlineActionStatusProps = {
  status: "idle" | "pending" | "success" | "error";
  message: string;
};

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current.slice(-3), { id, message, tone }]);
      window.setTimeout(() => removeToast(id), tone === "error" ? 7000 : 4500);
    },
    [removeToast],
  );

  const value = useMemo<FeedbackContextValue>(
    () => ({
      notify,
      success: (message) => notify(message, "success"),
      error: (message) => notify(message, "error"),
    }),
    [notify],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              type="button"
              onClick={() => removeToast(toast.id)}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useActionFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useActionFeedback must be used within ActionFeedbackProvider.");
  }
  return context;
}

export function FeedbackForm({
  action,
  children,
  className,
  confirmMessage,
  errorMessage = "Action failed. Try again.",
  onSuccess,
  pendingMessage = "Working...",
  resetOnSuccess = false,
  successMessage,
}: FeedbackFormProps) {
  const router = useRouter();
  const feedback = useActionFeedback();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<InlineActionStatusProps["status"]>("idle");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("pending");
    setMessage(pendingMessage);

    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result && result.ok === false) {
          const nextMessage = result.error ?? errorMessage;
          setStatus("error");
          setMessage(nextMessage);
          feedback.error(nextMessage);
          return;
        }

        const nextMessage = result?.message ?? successMessage;
        setStatus("success");
        setMessage(nextMessage);
        feedback.success(nextMessage);
        if (resetOnSuccess) form.reset();
        onSuccess?.();
        router.refresh();
      } catch (caught) {
        const nextMessage =
          caught instanceof Error && caught.message ? caught.message : errorMessage;
        setStatus("error");
        setMessage(nextMessage);
        feedback.error(nextMessage);
      }
    });
  }

  return (
    <FormFeedbackContext.Provider value={{ pending: isPending }}>
      <form className={className} onSubmit={handleSubmit}>
        {children}
        <InlineActionStatus status={status} message={message} />
      </form>
    </FormFeedbackContext.Provider>
  );
}

export function ActionSubmitButton({
  children,
  className = "button button-dark",
  disabled,
  formAction,
  name,
  pendingLabel = "Working...",
  type = "submit",
  value,
}: ActionSubmitButtonProps) {
  const context = useContext(FormFeedbackContext);
  const pending = context?.pending ?? false;

  return (
    <button
      className={className}
      disabled={disabled || pending}
      formAction={formAction}
      name={name}
      type={type}
      value={value}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function InlineActionStatus({ status, message }: InlineActionStatusProps) {
  if (status === "idle" || !message) return null;

  return (
    <p
      className={`form-status-message form-status-${status === "error" ? "error" : "success"}`}
      role={status === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
