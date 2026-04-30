/**
 * profileCompletion.ts
 *
 * Calculates profile completion percentage for a given user (client or cleaner).
 * Used by ProfileCompletionBar to decide whether to show the banner and what
 * the current progress is.
 *
 * Client fields (4 total):
 *   1. full_name present
 *   2. avatar_url present
 *   3. at least one ClientProperty saved
 *   4. Stripe customer id set (stripe_customer_id on the profile row, or we
 *      proxy via the `has_payment_method` flag we pass in)
 *
 * Cleaner fields (5 total):
 *   1. full_name present
 *   2. avatar_url present
 *   3. at least one active listing
 *   4. at least one verified document
 *   5. Stripe Connect account active
 *
 * We intentionally do NOT call Supabase here — callers pass in the data they
 * already have so this stays a pure, fast function with no side effects.
 */

export interface ClientCompletionInput {
  full_name?: string | null;
  avatar_url?: string | null;
  hasProperty: boolean;
  hasPaymentMethod: boolean;
}

export interface CleanerCompletionInput {
  full_name?: string | null;
  avatar_url?: string | null;
  hasActiveListing: boolean;
  hasVerifiedDocument: boolean;
  hasStripeConnect: boolean;
}

export interface CompletionResult {
  percent: number;        // 0–100, always a multiple of 25 (client) or 20 (cleaner)
  total: number;          // total fields
  completed: number;      // fields filled
  missingSteps: MissingStep[];
}

export type MissingStep =
  | "full_name"
  | "avatar"
  | "property"
  | "payment"
  | "listing"
  | "document"
  | "stripe_connect";

export function calculateClientCompletion(
  input: ClientCompletionInput
): CompletionResult {
  const checks: Array<{ key: MissingStep; done: boolean }> = [
    { key: "full_name", done: !!input.full_name?.trim() },
    { key: "avatar", done: !!input.avatar_url },
    { key: "property", done: input.hasProperty },
    { key: "payment", done: input.hasPaymentMethod },
  ];

  const completed = checks.filter((c) => c.done).length;
  const total = checks.length;
  const missingSteps = checks.filter((c) => !c.done).map((c) => c.key);

  return {
    percent: Math.round((completed / total) * 100),
    total,
    completed,
    missingSteps,
  };
}

export function calculateCleanerCompletion(
  input: CleanerCompletionInput
): CompletionResult {
  const checks: Array<{ key: MissingStep; done: boolean }> = [
    { key: "full_name", done: !!input.full_name?.trim() },
    { key: "avatar", done: !!input.avatar_url },
    { key: "listing", done: input.hasActiveListing },
    { key: "document", done: input.hasVerifiedDocument },
    { key: "stripe_connect", done: input.hasStripeConnect },
  ];

  const completed = checks.filter((c) => c.done).length;
  const total = checks.length;
  const missingSteps = checks.filter((c) => !c.done).map((c) => c.key);

  return {
    percent: Math.round((completed / total) * 100),
    total,
    completed,
    missingSteps,
  };
}

/**
 * Human-readable label for the first missing step — used as the banner CTA
 * subtitle so the user knows exactly what to do.
 */
export function firstMissingStepLabel(steps: MissingStep[]): string {
  const labels: Record<MissingStep, string> = {
    full_name: "Aggiungi il tuo nome",
    avatar: "Carica la tua foto",
    property: "Aggiungi un indirizzo casa",
    payment: "Aggiungi un metodo di pagamento",
    listing: "Crea il tuo primo annuncio",
    document: "Verifica la tua identità",
    stripe_connect: "Collega il tuo account pagamenti",
  };
  return steps.length > 0 ? labels[steps[0]] : "";
}
