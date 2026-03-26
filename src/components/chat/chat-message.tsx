import Image from "next/image";
import type { Message } from "@/types/message";

interface ChatMessageProps {
  message: Message;
  currentUserId: string;
}

export function ChatMessage({ message, currentUserId }: ChatMessageProps) {
  const isOwn = message.sender_id === currentUserId;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2.5`}>
      <div
        className={`max-w-[78%] px-4 py-2.5 text-[14px] leading-relaxed ${
          isOwn
            ? "rounded-2xl rounded-br-md bg-accent text-white shadow-sm shadow-accent/10"
            : "rounded-2xl rounded-bl-md bg-white text-primary shadow-sm ring-1 ring-black/[0.04]"
        }`}
      >
        {message.photo_url && (
          <div className="mb-2 rounded-xl overflow-hidden">
            <Image
              src={message.photo_url}
              alt="Foto messaggio"
              width={240}
              height={180}
              className="object-cover w-full"
            />
          </div>
        )}
        {message.content && <p>{message.content}</p>}
        <p className={`text-[10px] mt-1.5 ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>
          {new Date(message.created_at).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
