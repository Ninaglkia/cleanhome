"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { BottomNav } from "@/components/bottom-nav";
import { RoleSwitch } from "@/components/role-switch";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useRole } from "@/hooks/use-role";
import { GOOGLE_MAPS_API_KEY } from "@/lib/google-maps";

interface AppShellProps {
  activeRole: "cleaner" | "client";
  userName: string;
  children: React.ReactNode;
}

export function AppShell({ activeRole: initialRole, userName, children }: AppShellProps) {
  const { activeRole, switchRole, switching } = useRole(initialRole);

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["places"]}>
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-4 py-3 shadow-sm">
          <h1 className="font-serif text-2xl font-bold tracking-tight text-primary">
            Clean<span className="text-accent">Home</span>
          </h1>
          <div className="flex items-center gap-3">
            <NotificationBell role={activeRole} />
            <RoleSwitch activeRole={activeRole} onSwitch={switchRole} switching={switching} />
          </div>
        </header>
        <main>{children}</main>
        <BottomNav role={activeRole} />
      </div>
    </APIProvider>
  );
}
