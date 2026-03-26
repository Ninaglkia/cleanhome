import { cn } from "@/lib/utils";

interface RoleSwitchProps {
  activeRole: "cleaner" | "client";
  onSwitch: () => void;
  switching: boolean;
}

export function RoleSwitch({ activeRole, onSwitch, switching }: RoleSwitchProps) {
  return (
    <button onClick={onSwitch} disabled={switching} className="flex cursor-pointer items-center gap-1 rounded-full bg-muted/50 p-1 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50">
      <span data-active={activeRole === "client"} className={cn("rounded-full px-3 py-1.5 transition-all duration-200", activeRole === "client" ? "bg-white font-medium text-primary shadow-sm" : "text-muted-foreground")}>
        Cliente
      </span>
      <span data-active={activeRole === "cleaner"} className={cn("rounded-full px-3 py-1.5 transition-all duration-200", activeRole === "cleaner" ? "bg-white font-medium text-primary shadow-sm" : "text-muted-foreground")}>
        Pulitore
      </span>
    </button>
  );
}
