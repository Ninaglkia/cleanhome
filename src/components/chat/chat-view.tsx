"use client";

import { useRef, useState, useEffect } from "react";
import { Send } from "lucide-react";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { ChatMessage } from "./chat-message";
import { ChatPhotoInput } from "./chat-photo-input";
import { AntiContactWarning } from "./anti-contact-warning";
import type { Message } from "@/types/message";

interface ChatViewProps {
  bookingId: string;
  currentUserId: string;
  initialMessages: Message[];
  /** Structured booking metadata shown at the top */
  address: string | null;
  notes: string | null;
}

export function ChatView({
  bookingId,
  currentUserId,
  initialMessages,
  address,
  notes,
}: ChatViewProps) {
  const messages = useRealtimeMessages(bookingId, initialMessages);
  const { upload, uploading } = usePhotoUpload({ bookingId, photoType: "completion" });

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(content: string, photoUrl?: string) {
    setSending(true);
    setWarning(false);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, photo_url: photoUrl ?? null }),
      });
      const json = await res.json();
      if (json.warning) setWarning(true);
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && !uploading) return;
    setText("");
    await sendMessage(trimmed);
  }

  async function handlePhotoFile(file: File) {
    const photo = await upload(file);
    if (photo) await sendMessage("", photo.photo_url);
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Structured header: address + notes */}
      {(address || notes) && (
        <div className="mx-4 mt-3 mb-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.04] space-y-1.5">
          {address && (
            <p className="text-xs text-primary">
              <span className="font-bold">Indirizzo servizio:</span>{" "}
              <span className="text-muted-foreground">{address}</span>
            </p>
          )}
          {notes && (
            <p className="text-xs text-primary">
              <span className="font-bold">Note:</span>{" "}
              <span className="text-muted-foreground">{notes}</span>
            </p>
          )}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} currentUserId={currentUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Anti-contact warning */}
      <AntiContactWarning visible={warning} />

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="fixed bottom-0 left-0 right-0 flex items-center gap-2.5 border-t border-border/30 bg-white px-4 py-3 pb-safe"
      >
        <ChatPhotoInput onFile={handlePhotoFile} disabled={uploading || sending} />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi un messaggio..."
          className="flex-1 h-14 rounded-full bg-background px-5 text-sm text-primary ring-1 ring-border outline-none focus:ring-2 focus:ring-accent/30 transition-all placeholder:text-muted-foreground"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || (!text.trim() && !uploading)}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-white shadow-sm shadow-accent/20 transition-all duration-200 hover:bg-accent/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <Send className="h-5 w-5" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
