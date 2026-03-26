"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, MessageCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  role: "cleaner" | "client";
}

export function BottomNav({ role }: BottomNavProps) {
  const pathname = usePathname();

  const tabs = [
    { href: `/${role}`, icon: Home, label: "Home" },
    { href: `/${role}/search`, icon: Search, label: "Cerca" },
    { href: `/${role}/messages`, icon: MessageCircle, label: "Messaggi" },
    { href: `/${role}/profile`, icon: User, label: "Profilo" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around py-1.5">
        {tabs.map((tab) => {
          const isActive = tab.href === `/${role}` ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-1.5 text-xs font-medium transition-all duration-150",
                isActive ? "text-accent" : "text-muted-foreground hover:text-primary"
              )}
            >
              {isActive && (
                <span className="absolute -top-1.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-accent" />
              )}
              <tab.icon className={cn("h-5.5 w-5.5 transition-transform", isActive && "scale-110")} style={{ height: "1.25rem", width: "1.25rem" }} />
              <span className={cn("text-[11px]", isActive && "font-semibold")}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
