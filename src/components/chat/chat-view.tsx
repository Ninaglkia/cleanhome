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
    <div className="flex flex-col h-full">
      {/* Structured header: address + notes */}
      {(address || notes) && (
        <div className="mx-4 mt-3 mb-1 rounded-2xl bg-[#f0f4f3] border border-[#e0eae8] p-3 space-y-1">
          {address && (
            <p className="text-xs text-[#1a3a35]">
              <span className="font-semibold">Indirizzo servizio:</span> {address}
            </p>
          )}
          {notes && (
            <p className="text-xs text-[#6b7280]">
              <span className="font-semibold">Note:</span> {notes}
            </p>
          )}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
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
        className="flex items-center gap-2 px-4 py-3 border-t border-[#e0eae8] bg-white"
      >
        <ChatPhotoInput onFile={handlePhotoFile} disabled={uploading || sending} />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi un messaggio…"
          className="flex-1 rounded-full border border-[#e0eae8] px-4 py-2 text-sm outline-none focus:border-[#4fc4a3] transition-colors"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || (!text.trim() && !uploading)}
          className="rounded-full bg-[#1a3a35] text-white px-4 py-2 text-sm font-medium disabled:opacity-40 transition-opacity"
        >
          {sending ? "…" : "Invia"}
        </button>
      </form>
    </div>
  );
}
