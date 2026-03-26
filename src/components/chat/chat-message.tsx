import Image from "next/image";
import type { Message } from "@/types/message";

interface ChatMessageProps {
  message: Message;
  currentUserId: string;
}

export function ChatMessage({ message, currentUserId }: ChatMessageProps) {
  const isOwn = message.sender_id === currentUserId;

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
          isOwn
            ? "bg-[#4fc4a3] text-white rounded-br-md"
            : "bg-white text-[#1a3a35] border border-[#e0eae8] rounded-bl-md"
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
        <p className={`text-[10px] mt-1 ${isOwn ? "text-white/70" : "text-[#9ca3af]"}`}>
          {new Date(message.created_at).toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
