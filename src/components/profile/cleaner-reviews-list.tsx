import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StarRating } from "./star-rating";
import { Separator } from "@/components/ui/separator";

export interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
  reviewer_avatar: string | null;
}

interface CleanerReviewsListProps {
  reviews: Review[];
}

export function CleanerReviewsList({ reviews }: CleanerReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <div className="bg-card px-6 py-5">
        <h2 className="font-semibold text-primary">Recensioni</h2>
        <p className="mt-2 text-sm text-muted-foreground">Nessuna recensione ancora.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-card px-6 py-5 gap-4">
      <h2 className="font-semibold text-primary">
        Recensioni ({reviews.length})
      </h2>
      {reviews.map((review, idx) => (
        <div key={review.id}>
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={review.reviewer_avatar ?? undefined} />
              <AvatarFallback className="bg-muted text-xs font-semibold text-primary">
                {(review.reviewer_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-primary truncate">
                  {review.reviewer_name ?? "Utente anonimo"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <StarRating value={review.rating} />
              {review.comment && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {review.comment}
                </p>
              )}
            </div>
          </div>
          {idx < reviews.length - 1 && <Separator className="mt-4" />}
        </div>
      ))}
    </div>
  );
}
