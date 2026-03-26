import { cn } from "@/lib/utils";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps) {
  return (
    <ol className="flex items-center justify-center gap-2" aria-label="Progresso onboarding">
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
              "h-2.5 rounded-full transition-all duration-300",
              isActive ? "w-6 bg-accent" : isDone ? "w-2.5 bg-accent/60" : "w-2.5 bg-muted"
            )}
          />
        );
      })}
    </ol>
  );
}
