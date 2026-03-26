"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StarRatingInput } from "@/components/profile/star-rating-input";
import { Button } from "@/components/ui/button";

interface ReviewFormProps {
  bookingId: string;
  reviewedName: string;
  /** Path to redirect to after successful submit */
  redirectTo: string;
}

export function ReviewForm({ bookingId, reviewedName, redirectTo }: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Seleziona una valutazione.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Errore durante l'invio.");
        return;
      }
      router.push(redirectTo);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[#1a3a35]">
          Valuta {reviewedName}
        </h1>
        <p className="text-sm text-[#6b7280]">
          La tua recensione sarà visibile pubblicamente sul loro profilo.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-[#1a3a35]">Valutazione *</span>
        <StarRatingInput value={rating} onChange={setRating} disabled={submitting} />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="comment" className="text-sm font-medium text-[#1a3a35]">
          Commento (facoltativo)
        </label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Racconta la tua esperienza…"
          rows={4}
          maxLength={1000}
          disabled={submitting}
          className="w-full rounded-2xl border border-[#e0eae8] px-4 py-3 text-sm outline-none focus:border-[#4fc4a3] resize-none disabled:opacity-50"
        />
        <span className="text-xs text-[#6b7280] self-end">{comment.length}/1000</span>
      </div>

      {error && (
        <p className="text-sm text-[#e53e3e]">{error}</p>
      )}

      <Button
        type="submit"
        disabled={submitting || rating === 0}
        className="w-full"
        size="lg"
      >
        {submitting ? "Invio…" : "Invia recensione"}
      </Button>
    </form>
  );
}
