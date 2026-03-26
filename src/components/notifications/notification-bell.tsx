"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  role: "cleaner" | "client";
  initialUnread?: number;
}

export function NotificationBell({ role, initialUnread = 0 }: NotificationBellProps) {
  const [unread, setUnread] = useState(initialUnread);
  const supabase = createClient();

  useEffect(() => {
    let userId: string | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Fetch current unread count
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setUnread(count ?? 0);

      // Subscribe to new notifications via Realtime
      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            setUnread((prev) => prev + 1);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            // When a notification is marked read, decrement count
            if (payload.new?.is_read && !payload.old?.is_read) {
              setUnread((prev) => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    const cleanup = init();
    return () => {
      cleanup.then((fn) => fn?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayCount = unread > 99 ? "99+" : unread;

  return (
    <Link
      href={`/${role}/notifications`}
      aria-label={`Notifiche${unread > 0 ? `, ${displayCount} non lette` : ""}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-accent/10"
    >
      <Bell
        className={cn("h-5 w-5", unread > 0 ? "text-primary" : "text-muted-foreground")}
      />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 py-0.5 text-[10px] font-bold leading-none text-white">
          {displayCount}
        </span>
      )}
    </Link>
  );
}
