import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RoleCard } from "@/components/role-card";

describe("RoleCard", () => {
  it("renders title and description", () => {
    render(
      <RoleCard title="Sono un pulitore" description="Offri i tuoi servizi di pulizia" icon="sparkles" selected={false} onClick={vi.fn()} />
    );
    expect(screen.getByText("Sono un pulitore")).toBeInTheDocument();
    expect(screen.getByText("Offri i tuoi servizi di pulizia")).toBeInTheDocument();
  });

  it("applies selected styles when selected", () => {
    render(
      <RoleCard title="Sono un pulitore" description="Offri i tuoi servizi" icon="sparkles" selected={true} onClick={vi.fn()} />
    );
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-selected", "true");
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <RoleCard title="Sono un pulitore" description="Offri i tuoi servizi" icon="sparkles" selected={false} onClick={onClick} />
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
