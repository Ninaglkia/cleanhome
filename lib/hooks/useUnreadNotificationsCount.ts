import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Lightweight hook that returns only the unread notification count.
 * Uses a COUNT query (no full row fetch) and a realtime subscription
 * so the badge stays in sync without polling.
 *
 * Intentionally decoupled from useNotifications to avoid re-fetching
 * the full list just to refresh the badge.
 */
export function useUnreadNotificationsCount(userId: string | null | undefined) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (!userId) {
      setCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { count: raw, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);

      if (!isMountedRef.current) return;

      if (error) {
        // Table may not exist yet — treat as 0
        if (
          error.code === "42P01" ||
          error.message?.includes("does not exist")
        ) {
          setCount(0);
        }
        // Other errors: keep previous count, don't crash
      } else {
        setCount(raw ?? 0);
      }
    } catch {
      // Silent — badge is non-critical
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Realtime: re-count on any INSERT or UPDATE to this user's notifications
  useEffect(() => {
    if (!userId) return;

    channelRef.current = supabase
      .channel(`notif-count-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (isMountedRef.current) {
            setCount((prev) => prev + 1);
          }
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
        () => {
          // On any update (e.g. mark-as-read) re-fetch the exact count
          if (isMountedRef.current) refetch();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, refetch]);

  return { count, loading, refetch };
}
