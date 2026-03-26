-- Add stripe_payment_intent_id to bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Add stripe_account_id to profiles table (for cleaner's connected account)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text;
