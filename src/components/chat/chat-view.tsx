"use client";

import { useRef, useState, useEffect } from "react";
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
        className="flex items-center gap-2.5 px-4 py-3 bg-white shadow-[0_-1px_3px_rgba(0,0,0,0.04)] pb-safe"
      >
        <ChatPhotoInput onFile={handlePhotoFile} disabled={uploading || sending} />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi un messaggio..."
          className="flex-1 h-11 rounded-full bg-background px-5 text-sm text-primary ring-1 ring-border outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-muted-foreground"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || (!text.trim() && !uploading)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-sm shadow-accent/20 disabled:opacity-30 transition-all hover:bg-accent/90 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 -rotate-45">
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
