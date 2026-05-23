-- Migration: profiles.welcome_email_sent_at
-- Idempotency flag for the send-welcome-email edge function so each user
-- receives the branded welcome email exactly once (across email/Google/Apple).

alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz;

comment on column public.profiles.welcome_email_sent_at is
  'Set by the send-welcome-email edge function the first time the welcome email is sent. Used for idempotency so each user is emailed once.';
