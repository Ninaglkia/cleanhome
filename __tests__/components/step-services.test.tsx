import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { StepServices } from "@/components/onboarding/step-services";
import type { OnboardingDraft } from "@/hooks/use-onboarding-draft";

const baseDraft: OnboardingDraft = {
  step: 2,
  avatarFile: null,
  avatarPreview: "",
  fullName: "Mario Rossi",
  city: "Roma",
  cityLat: 41.9,
  cityLng: 12.5,
  bio: "",
  cleanerType: "privato",
  hourlyRate: "",
  services: [],
  isAvailable: true,
};

describe("StepServices", () => {
  it("renders type toggle and rate input", () => {
    render(<StepServices draft={baseDraft} setDraft={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText(/privato/i)).toBeInTheDocument();
    expect(screen.getByText(/azienda/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tariffa oraria/i)).toBeInTheDocument();
  });

  it("renders all service checkboxes", () => {
    render(<StepServices draft={baseDraft} setDraft={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByLabelText(/pulizia ordinaria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stiratura/i)).toBeInTheDocument();
  });

  it("disables Avanti when no services and no rate", () => {
    render(<StepServices draft={baseDraft} setDraft={vi.fn()} onNext={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /avanti/i })).toBeDisabled();
  });

  it("enables Avanti when rate > 0 and at least one service", () => {
    render(
      <StepServices
        draft={{ ...baseDraft, hourlyRate: "20", services: ["Pulizia ordinaria"] }}
        setDraft={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /avanti/i })).not.toBeDisabled();
  });

  it("calls onBack when Indietro is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <StepServices
        draft={{ ...baseDraft, hourlyRate: "20", services: ["Pulizia ordinaria"] }}
        setDraft={vi.fn()}
        onNext={vi.fn()}
        onBack={onBack}
      />
    );
    await user.click(screen.getByRole("button", { name: /indietro/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
