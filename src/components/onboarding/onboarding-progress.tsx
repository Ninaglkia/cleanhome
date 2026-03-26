import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_LABELS = ["Profilo", "Servizi", "Conferma"];

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <div className="flex flex-col items-center gap-4" aria-label="Progresso onboarding">
      <ol className="flex items-center gap-0">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isLast = stepNum === totalSteps;
          return (
            <li key={stepNum} className="flex items-center" role="listitem" aria-current={isActive ? "step" : undefined}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-300 ease-out",
                    isActive
                      ? "h-4 w-4 bg-accent shadow-sm shadow-accent/30"
                      : isDone
                        ? "h-3 w-3 bg-accent/50"
                        : "h-3 w-3 bg-muted"
                  )}
                />
                <span className={cn(
                  "text-[11px] font-medium transition-colors",
                  isActive ? "text-accent" : isDone ? "text-accent/60" : "text-muted-foreground"
                )}>
                  {STEP_LABELS[i] ?? `Passo ${stepNum}`}
                </span>
              </div>
              {!isLast && (
                <div className={cn(
                  "mx-3 mb-5 h-0.5 w-10 rounded-full transition-colors duration-300",
                  isDone ? "bg-accent/50" : "bg-muted"
                )} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs font-medium text-muted-foreground">
        Passo {currentStep} di {totalSteps}
      </p>
    </div>
  );
}
