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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white pb-safe shadow-[0_-1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around px-2 pb-1 pt-2">
        {tabs.map((tab) => {
          const isActive = tab.href === `/${role}` ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs font-medium transition-all duration-200",
                isActive ? "text-accent" : "text-muted-foreground hover:text-primary"
              )}
            >
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
                isActive && "bg-accent/10"
              )}>
                <tab.icon
                  className={cn("transition-all duration-200", isActive && "text-accent")}
                  style={{ height: "1.25rem", width: "1.25rem" }}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
              </div>
              <span className={cn("text-[10px] leading-tight", isActive && "font-bold")}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
