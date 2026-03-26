import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RoleSwitch } from "@/components/role-switch";

describe("RoleSwitch", () => {
  it("renders both role labels", () => {
    render(<RoleSwitch activeRole="client" onSwitch={() => {}} switching={false} />);
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByText("Pulitore")).toBeInTheDocument();
  });

  it("highlights the active role", () => {
    render(<RoleSwitch activeRole="cleaner" onSwitch={() => {}} switching={false} />);
    const pulitoreLabel = screen.getByText("Pulitore");
    expect(pulitoreLabel.closest("[data-active]")).toHaveAttribute("data-active", "true");
  });
});
