"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/message";

export function useRealtimeMessages(bookingId: string, initial: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const supabase = createClient();
  // Use a ref so the channel is stable across re-renders
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:booking_id=eq.${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates if the sender's optimistic update is already there
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  return messages;
}
