import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SplashScreen } from "@/components/splash-screen";

describe("SplashScreen", () => {
  it("renders the CleanHome logo text", () => {
    render(<SplashScreen onComplete={vi.fn()} />);
    expect(screen.getByText("CleanHome")).toBeInTheDocument();
  });

  it("renders the tagline", () => {
    render(<SplashScreen onComplete={vi.fn()} />);
    expect(
      screen.getByText("Trova il pulitore perfetto")
    ).toBeInTheDocument();
  });

  it("calls onComplete after animation", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<SplashScreen onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    expect(onComplete).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
