interface StepIndicatorProps {
  currentStep: 1 | 2;
}

function OrgIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { num: 1, label: "Organization", Icon: OrgIcon },
    { num: 2, label: "Review Profile", Icon: ReviewIcon },
  ] as const;

  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      {steps.map((step, i) => {
        const isActive = step.num === currentStep;
        const isCompleted = step.num < currentStep;

        return (
          <div key={step.num} className="flex items-center gap-3">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  isActive || isCompleted
                    ? "bg-brand text-white"
                    : "bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500"
                }`}
              >
                {isCompleted ? <CheckIcon /> : <step.Icon />}
              </div>
              <span
                className={`text-xs font-medium transition-colors ${
                  isActive
                    ? "text-zinc-900 dark:text-zinc-100"
                    : isCompleted
                      ? "text-brand"
                      : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (after first step only) */}
            {i < steps.length - 1 && (
              <div
                className={`mb-5 h-px w-12 transition-colors ${
                  isCompleted ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
