"use client";

import { BottomNav } from "@/components/bottom-nav";
import { RoleSwitch } from "@/components/role-switch";
import { useRole } from "@/hooks/use-role";

interface AppShellProps {
  activeRole: "cleaner" | "client";
  userName: string;
  children: React.ReactNode;
}

export function AppShell({ activeRole: initialRole, userName, children }: AppShellProps) {
  const { activeRole, switchRole, switching } = useRole(initialRole);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h1 className="font-serif text-xl text-primary">CleanHome</h1>
        <RoleSwitch activeRole={activeRole} onSwitch={switchRole} switching={switching} />
      </header>
      <main>{children}</main>
      <BottomNav role={activeRole} />
    </div>
  );
}
