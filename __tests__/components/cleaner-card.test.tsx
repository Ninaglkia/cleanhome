import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CleanerCard } from "@/components/cleaners/cleaner-card";
import type { CleanerProfile } from "@/types/cleaner";

const mockCleaner: CleanerProfile = {
  id: "abc-123",
  full_name: "Laura Bianchi",
  avatar_url: null,
  bio: "Esperta pulizie",
  city: "Roma, Italia",
  cleaner_type: "privato",
  hourly_rate: 18,
  services: ["Pulizia ordinaria", "Stiratura"],
  is_available: true,
  avg_rating: 4.7,
  review_count: 23,
  distance_km: 2.4,
};

describe("CleanerCard", () => {
  it("renders cleaner name", () => {
    render(<CleanerCard cleaner={mockCleaner} onClick={vi.fn()} />);
    expect(screen.getByText("Laura Bianchi")).toBeInTheDocument();
  });

  it("shows availability dot when available", () => {
    render(<CleanerCard cleaner={mockCleaner} onClick={vi.fn()} />);
    expect(screen.getByLabelText(/disponibile/i)).toBeInTheDocument();
  });

  it("shows hourly rate", () => {
    render(<CleanerCard cleaner={mockCleaner} onClick={vi.fn()} />);
    expect(screen.getByText(/€18\/ora/i)).toBeInTheDocument();
  });

  it("shows distance", () => {
    render(<CleanerCard cleaner={mockCleaner} onClick={vi.fn()} />);
    expect(screen.getByText(/2\.4 km/i)).toBeInTheDocument();
  });

  it("shows badge type", () => {
    render(<CleanerCard cleaner={mockCleaner} onClick={vi.fn()} />);
    expect(screen.getByText(/privato/i)).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<CleanerCard cleaner={mockCleaner} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith("abc-123");
  });
});
