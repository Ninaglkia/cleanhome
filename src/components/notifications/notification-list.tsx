"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  data: Record<string, string> | null;
}

interface NotificationListProps {
  userId: string;
}

export function NotificationList({ userId }: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, is_read, created_at, data")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel(`notif-list:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications, supabase, userId]);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAllRead(true);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds }),
    });
    setMarkingAllRead(false);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header actions */}
      {unreadCount > 0 && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {unreadCount} non {unreadCount === 1 ? "letta" : "lette"}
          </span>
          <button
            onClick={markAllRead}
            disabled={markingAllRead}
            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Segna tutte come lette
          </button>
        </div>
      )}

      {/* Notification items */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <BellOff className="h-10 w-10 opacity-40" />
          <p className="text-sm">Nessuna notifica</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {notifications.map((notif) => (
            <li
              key={notif.id}
              className={cn(
                "flex cursor-pointer gap-3 px-4 py-4 transition-colors hover:bg-muted/50",
                !notif.is_read && "bg-accent/5"
              )}
              onClick={() => !notif.is_read && markAsRead(notif.id)}
            >
              {/* Unread dot */}
              <div className="mt-1.5 flex-shrink-0">
                {notif.is_read ? (
                  <Bell className="h-4 w-4 text-muted-foreground/40" />
                ) : (
                  <span className="flex h-2 w-2 rounded-full bg-accent" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm leading-snug",
                    notif.is_read ? "text-muted-foreground" : "font-medium text-primary"
                  )}
                >
                  {notif.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                  {notif.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  {formatDistanceToNow(new Date(notif.created_at), {
                    addSuffix: true,
                    locale: it,
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
