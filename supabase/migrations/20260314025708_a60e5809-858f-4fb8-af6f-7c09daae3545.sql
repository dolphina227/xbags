
-- Create tables first
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.message_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unread_count INT DEFAULT 0 NOT NULL,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(conversation_id, profile_id)
);
ALTER TABLE public.message_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS
CREATE POLICY "Anyone can read conversations" ON public.conversations FOR SELECT TO public USING (true);
CREATE POLICY "Can insert conversations" ON public.conversations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Can update conversations" ON public.conversations FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read participants" ON public.message_participants FOR SELECT TO public USING (true);
CREATE POLICY "Can join conversation" ON public.message_participants FOR INSERT TO public WITH CHECK (profile_exists(profile_id));
CREATE POLICY "Can update own participation" ON public.message_participants FOR UPDATE TO public USING (profile_exists(profile_id)) WITH CHECK (profile_exists(profile_id));

CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT TO public USING (true);
CREATE POLICY "Can send messages" ON public.messages FOR INSERT TO public WITH CHECK (profile_exists(sender_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Notification triggers
DROP TRIGGER IF EXISTS trg_notify_like ON public.post_likes;
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION notify_on_like();

DROP TRIGGER IF EXISTS trg_notify_comment ON public.post_comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

DROP TRIGGER IF EXISTS trg_notify_repost ON public.posts;
CREATE TRIGGER trg_notify_repost AFTER INSERT ON public.posts FOR EACH ROW WHEN (NEW.post_type IN ('repost', 'quote')) EXECUTE FUNCTION notify_on_repost();

DROP TRIGGER IF EXISTS trg_notify_mention ON public.posts;
CREATE TRIGGER trg_notify_mention AFTER INSERT ON public.posts FOR EACH ROW WHEN (NEW.post_type = 'tweet' AND NEW.content LIKE '%@%') EXECUTE FUNCTION notify_on_mention();

-- DM notification
CREATE OR REPLACE FUNCTION public.notify_on_dm()
RETURNS TRIGGER AS $$
DECLARE v_recipient_id UUID; v_actor_name TEXT;
BEGIN
  SELECT mp.profile_id INTO v_recipient_id FROM message_participants mp
  WHERE mp.conversation_id = NEW.conversation_id AND mp.profile_id != NEW.sender_id LIMIT 1;
  IF v_recipient_id IS NULL THEN RETURN NEW; END IF;
  v_actor_name := get_display_name(NEW.sender_id);
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (v_recipient_id, 'dm', 'New Message', v_actor_name || ' sent you a message',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'actor_id', NEW.sender_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trg_notify_dm ON public.messages;
CREATE TRIGGER trg_notify_dm AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION notify_on_dm();

-- Mark messages read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID, p_profile_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE message_participants SET unread_count = 0, last_read_at = NOW()
  WHERE conversation_id = p_conversation_id AND profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
