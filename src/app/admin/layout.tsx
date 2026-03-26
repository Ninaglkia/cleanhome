"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  AlertTriangle,
  Wallet,
  Images,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Utenti", icon: Users },
  { href: "/admin/bookings", label: "Prenotazioni", icon: CalendarDays },
  { href: "/admin/disputes", label: "Dispute", icon: AlertTriangle },
  { href: "/admin/payouts", label: "Payout", icon: Wallet },
  { href: "/admin/photos", label: "Foto archivio", icon: Images },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ backgroundColor: "#1a3a35" }}>
        <div className="px-6 py-5 border-b border-white/10">
          <span className="font-serif text-lg text-white">CleanHome</span>
          <span className="block text-xs text-white/50 mt-0.5">Admin Panel</span>
        </div>
        <nav className="flex-1 py-4">
          <AdminNav />
        </nav>
      </aside>
      <main className="flex-1 min-h-screen bg-white overflow-auto">
        {children}
      </main>
    </div>
  );
}

function AdminNav() {
  const pathname = usePathname();

  return (
    <ul className="space-y-0.5 px-3">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
