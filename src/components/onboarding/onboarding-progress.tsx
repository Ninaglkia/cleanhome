import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <div className="flex flex-col items-center gap-3" aria-label="Progresso onboarding">
      <ol className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isDone = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          return (
            <li
              key={stepNum}
              role="listitem"
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "rounded-full transition-all duration-500 ease-out",
                isActive ? "h-2.5 w-8 bg-accent shadow-sm shadow-accent/30" : isDone ? "h-2.5 w-2.5 bg-accent/50" : "h-2.5 w-2.5 bg-muted"
              )}
            />
          );
        })}
      </ol>
      <p className="text-xs font-medium text-muted-foreground">
        Passo {currentStep} di {totalSteps}
      </p>
    </div>
  );
}
