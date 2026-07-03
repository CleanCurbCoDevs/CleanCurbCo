"use client";

import {
  ActionSubmitButton,
  FeedbackForm,
} from "@/components/action-feedback";
import { sendPaymentLinkFromFieldAction } from "@/app/field/actions";

type FieldPaymentEmailFormProps = {
  bookingId: string;
  hasPaymentLink: boolean;
  isPaid: boolean;
  routeStopId: string;
  visitId: string;
};

export function FieldPaymentEmailForm({
  bookingId,
  hasPaymentLink,
  isPaid,
  routeStopId,
  visitId,
}: FieldPaymentEmailFormProps) {
  if (isPaid) return null;

  if (!hasPaymentLink) {
    return (
      <div className="field-disabled-action">
        <button className="button button-outline" type="button" disabled>
          Send Payment Email
        </button>
        <p>
          Create a Stripe payment link first, then send the payment email from
          this stop.
        </p>
      </div>
    );
  }

  return (
    <FeedbackForm
      action={sendPaymentLinkFromFieldAction}
      className="field-inline-action-form"
      pendingMessage="Sending payment email..."
      successMessage="Payment email sent."
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="visitId" value={visitId} />
      <input type="hidden" name="routeStopId" value={routeStopId} />
      <ActionSubmitButton className="button button-outline" pendingLabel="Sending...">
        Send Payment Email
      </ActionSubmitButton>
    </FeedbackForm>
  );
}
