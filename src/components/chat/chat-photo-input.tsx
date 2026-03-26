"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";

interface ChatPhotoInputProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function ChatPhotoInput({ onFile, disabled }: ChatPhotoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          // Reset so same file can be re-selected
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="p-2 rounded-full text-[#4fc4a3] hover:bg-[#f0f4f3] transition-colors disabled:opacity-40"
        aria-label="Allega foto"
      >
        <Camera size={20} />
      </button>
    </>
  );
}
