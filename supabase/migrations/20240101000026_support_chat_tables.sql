-- AI support chat: persistent threads + messages + escalation tracking
CREATE TABLE IF NOT EXISTS public.support_chats (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject      text,
  escalated_at timestamp with time zone,
  resolved_at  timestamp with time zone,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_chats_user_active
  ON public.support_chats (user_id, updated_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.support_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content    text NOT NULL,
  metadata   jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_chat_time
  ON public.support_messages (chat_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_support_chat()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.support_chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_support_chat ON public.support_messages;
CREATE TRIGGER trg_touch_support_chat
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_chat();

ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own support chats" ON public.support_chats;
CREATE POLICY "users read own support chats" ON public.support_chats
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users read own support messages" ON public.support_messages;
CREATE POLICY "users read own support messages" ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_chats c
      WHERE c.id = chat_id AND c.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.support_chats IS 'AI support conversations. Inserts and updates only via support-chat edge function.';
COMMENT ON COLUMN public.support_chats.escalated_at IS 'Set when conversation is escalated to human (email sent to support team)';
