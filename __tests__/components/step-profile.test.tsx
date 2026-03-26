import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { StepProfile } from "@/components/onboarding/step-profile";
import type { OnboardingDraft } from "@/hooks/use-onboarding-draft";

const baseDraft: OnboardingDraft = {
  step: 1,
  avatarFile: null,
  avatarPreview: "",
  fullName: "",
  city: "",
  cityLat: null,
  cityLng: null,
  bio: "",
  cleanerType: "privato",
  hourlyRate: "",
  services: [],
  isAvailable: true,
};

describe("StepProfile", () => {
  it("renders all fields", () => {
    render(<StepProfile draft={baseDraft} setDraft={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/città/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bio/i)).toBeInTheDocument();
  });

  it("disables Avanti when fullName is empty", () => {
    render(<StepProfile draft={baseDraft} setDraft={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole("button", { name: /avanti/i })).toBeDisabled();
  });

  it("enables Avanti when fullName and city are filled", () => {
    render(
      <StepProfile
        draft={{ ...baseDraft, fullName: "Mario Rossi", city: "Roma", cityLat: 41.9, cityLng: 12.5 }}
        setDraft={vi.fn()}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /avanti/i })).not.toBeDisabled();
  });

  it("calls onNext when Avanti is clicked", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <StepProfile
        draft={{ ...baseDraft, fullName: "Mario Rossi", city: "Roma", cityLat: 41.9, cityLng: 12.5 }}
        setDraft={vi.fn()}
        onNext={onNext}
      />
    );
    await user.click(screen.getByRole("button", { name: /avanti/i }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("shows char count for bio", async () => {
    const user = userEvent.setup();
    const setDraft = vi.fn();
    const { rerender } = render(
      <StepProfile draft={baseDraft} setDraft={setDraft} onNext={vi.fn()} />
    );
    const textarea = screen.getByLabelText(/bio/i);
    await user.type(textarea, "Ciao");
    rerender(
      <StepProfile
        draft={{ ...baseDraft, bio: "Ciao" }}
        setDraft={setDraft}
        onNext={vi.fn()}
      />
    );
    expect(screen.getByText(/4 \/ 500/i)).toBeInTheDocument();
  });
});
