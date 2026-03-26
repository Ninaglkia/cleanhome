import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(key, {
    apiVersion: "2026-03-25.dahlia" as Stripe.LatestApiVersion,
    typescript: true,
  });
}

let _stripe: Stripe | null = null;

export function getStripeServer() {
  if (!_stripe) {
    _stripe = getStripe();
  }
  return _stripe;
}

// Lazy — only throws at runtime when actually used, not at import time
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripeServer() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
