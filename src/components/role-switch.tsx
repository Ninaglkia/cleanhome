import { cn } from "@/lib/utils";

interface RoleSwitchProps {
  activeRole: "cleaner" | "client";
  onSwitch: () => void;
  switching: boolean;
}

export function RoleSwitch({ activeRole, onSwitch, switching }: RoleSwitchProps) {
  return (
    <button onClick={onSwitch} disabled={switching} className="flex items-center gap-1 rounded-full bg-muted p-1 text-sm">
      <span data-active={activeRole === "client"} className={cn("rounded-full px-3 py-1 transition-colors", activeRole === "client" ? "bg-accent font-medium text-primary" : "text-muted-foreground")}>
        Cliente
      </span>
      <span data-active={activeRole === "cleaner"} className={cn("rounded-full px-3 py-1 transition-colors", activeRole === "cleaner" ? "bg-accent font-medium text-primary" : "text-muted-foreground")}>
        Pulitore
      </span>
    </button>
  );
}
