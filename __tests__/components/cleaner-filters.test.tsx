import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CleanerFilters } from "@/components/cleaners/cleaner-filters";
import { DEFAULT_FILTERS } from "@/types/cleaner";

describe("CleanerFilters", () => {
  it("renders zone input", () => {
    render(<CleanerFilters filters={DEFAULT_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/zona o città/i)).toBeInTheDocument();
  });

  it("renders type filter buttons", () => {
    render(<CleanerFilters filters={DEFAULT_FILTERS} onChange={vi.fn()} />);
    // Multiple "Tutti" buttons exist (type, rating, and service rows)
    expect(screen.getAllByRole("button", { name: /tutti/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /privato/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /azienda/i })).toBeInTheDocument();
  });

  it("calls onChange with updated type when chip is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CleanerFilters filters={DEFAULT_FILTERS} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /privato/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "privato" })
    );
  });

  it("renders sort select", () => {
    render(<CleanerFilters filters={DEFAULT_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
