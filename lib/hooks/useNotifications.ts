import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType = "booking" | "message" | "system";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link_path: string | null;
  read_at: string | null;
  created_at: string;
}

export type NotificationFilter = "all" | "bookings" | "messages" | "system";

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNotifications(userId: string | null | undefined) {
  const [data, setData] = useState<AppNotification[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetch = useCallback(async () => {
    if (!userId) {
      setData([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: rows, error: fetchError } = await supabase
        .from("notifications")
        .select("id, user_id, type, title, body, link_path, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchError) {
        // Table may not exist yet — treat as empty, not a fatal error
        if (
          fetchError.code === "42P01" ||
          fetchError.message?.includes("does not exist")
        ) {
          if (isMountedRef.current) setData([]);
        } else {
          throw fetchError;
        }
      } else {
        if (isMountedRef.current) setData((rows as AppNotification[]) ?? []);
      }
    } catch (e) {
      if (isMountedRef.current) {
        setError(e instanceof Error ? e : new Error("Impossibile caricare le notifiche"));
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  // Mark a single notification as read
  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      // Capture previous read_at before optimistic update
      let previousReadAt: string | null = null;
      setData((prev) => {
        if (!prev) return prev;
        return prev.map((n) => {
          if (n.id === id) {
            previousReadAt = n.read_at;
            return { ...n, read_at: new Date().toISOString() };
          }
          return n;
        });
      });
      try {
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id)
          .eq("user_id", userId);
      } catch {
        // Revert to the original read_at (not blindly null)
        setData((prev) =>
          prev
            ? prev.map((n) => (n.id === id ? { ...n, read_at: previousReadAt } : n))
            : prev
        );
      }
    },
    [userId]
  );

  // Mark ALL unread notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setData((prev) =>
      prev
        ? prev.map((n) => (n.read_at ? n : { ...n, read_at: now }))
        : prev
    );
    try {
      await supabase
        .from("notifications")
        .update({ read_at: now })
        .eq("user_id", userId)
        .is("read_at", null);
    } catch {
      // Re-fetch to restore correct state
      if (isMountedRef.current) fetch();
    }
  }, [userId, fetch]);

  // Initial load
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime subscription: INSERT and UPDATE on notifications for this user
  useEffect(() => {
    if (!userId) return;

    channelRef.current = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as AppNotification;
          setData((prev) => (prev ? [newNotif, ...prev] : [newNotif]));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification;
          setData((prev) =>
            prev ? prev.map((n) => (n.id === updated.id ? updated : n)) : prev
          );
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return {
    data,
    isLoading,
    error,
    refetch: fetch,
    markAsRead,
    markAllAsRead,
  };
}
