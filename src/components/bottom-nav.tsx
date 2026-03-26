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
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card pb-safe">
      <div className="flex items-center justify-around py-2">
        {tabs.map((tab) => {
          const isActive = tab.href === `/${role}` ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={cn("flex flex-col items-center gap-1 px-3 py-1 text-xs transition-colors", isActive ? "text-accent" : "text-muted-foreground")}>
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
