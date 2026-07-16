import {
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  Sparkles,
} from "lucide-react";

type FieldServiceProgressProps = {
  status: string;
  beforePhotoCount: number;
  afterPhotoCount: number;
  checklistComplete: boolean;
};

type ServiceStep = {
  label: string;
  shortLabel: string;
  icon: typeof MapPin;
  complete: boolean;
  active: boolean;
};

export function FieldServiceProgress({
  status,
  beforePhotoCount,
  afterPhotoCount,
  checklistComplete,
}: FieldServiceProgressProps) {
  const serviceStarted = [
    "in_progress",
    "completed",
    "needs_follow_up",
  ].includes(status);

  const serviceCompleted = status === "completed";

  const steps: ServiceStep[] = [
    {
      label: "Service Started",
      shortLabel: "Start",
      icon: MapPin,
      complete: serviceStarted || serviceCompleted,
      active: !serviceStarted && !serviceCompleted,
    },
    {
      label: "Before Photos",
      shortLabel: "Before",
      icon: Camera,
      complete: beforePhotoCount > 0,
      active:
        serviceStarted &&
        beforePhotoCount === 0 &&
        !serviceCompleted,
    },
    {
      label: "Cleaning Checklist",
      shortLabel: "Clean",
      icon: ClipboardCheck,
      complete: checklistComplete,
      active:
        beforePhotoCount > 0 &&
        !checklistComplete &&
        !serviceCompleted,
    },
    {
      label: "After Photos",
      shortLabel: "After",
      icon: Sparkles,
      complete: afterPhotoCount > 0,
      active:
        checklistComplete &&
        afterPhotoCount === 0 &&
        !serviceCompleted,
    },
    {
      label: "Stop Complete",
      shortLabel: "Done",
      icon: CheckCircle2,
      complete: serviceCompleted,
      active:
        checklistComplete &&
        afterPhotoCount > 0 &&
        !serviceCompleted,
    },
  ];

  return (
    <section
      className="service-progress"
      aria-label="Service progress"
    >
      <div className="service-progress-heading">
        <div>
          <p className="section-kicker">Current Mission</p>
          <h2>Complete this stop</h2>
        </div>

        <strong>
          {steps.filter((step) => step.complete).length} /{" "}
          {steps.length}
        </strong>
      </div>

      <div className="service-progress-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <div
              className={[
                "service-progress-step",
                step.complete ? "is-complete" : "",
                step.active ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={step.label}
            >
              <span className="service-progress-icon">
                {step.complete ? (
                  <Check size={20} aria-hidden="true" />
                ) : (
                  <Icon size={20} aria-hidden="true" />
                )}
              </span>

              <span className="service-progress-label">
                <strong>{step.shortLabel}</strong>
                <small>{step.label}</small>
              </span>

              {index < steps.length - 1 ? (
                <span
                  className="service-progress-line"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}