
-- 1. REALTIME PUBLICATION (skip notifications, already added)
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE post_reposts;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE follows;

-- 2. POST_VIEWS TABLE (deduplication)
CREATE TABLE IF NOT EXISTS post_views (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id  TEXT,
  viewed_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_user ON post_views (post_id, viewer_id) WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_session ON post_views (post_id, session_id) WHERE session_id IS NOT NULL AND viewer_id IS NULL;

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert views" ON post_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can read views" ON post_views FOR SELECT TO anon, authenticated USING (true);

-- 3. FUNCTION: increment_post_view with dedup
CREATE OR REPLACE FUNCTION public.increment_post_view(
  p_post_id UUID,
  p_viewer_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_rows INT := 0;
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    INSERT INTO post_views (post_id, viewer_id) VALUES (p_post_id, p_viewer_id)
    ON CONFLICT (post_id, viewer_id) WHERE viewer_id IS NOT NULL DO NOTHING;
  ELSIF p_session_id IS NOT NULL THEN
    INSERT INTO post_views (post_id, session_id) VALUES (p_post_id, p_session_id)
    ON CONFLICT (post_id, session_id) WHERE session_id IS NOT NULL AND viewer_id IS NULL DO NOTHING;
  ELSE RETURN;
  END IF;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    UPDATE posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = p_post_id;
  END IF;
END;
$$;

-- 4. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_post_author_id(p_post_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT user_id FROM posts WHERE id = p_post_id LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.get_display_name(p_user_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE(display_name, username, 'Someone') FROM profiles WHERE id = p_user_id LIMIT 1; $$;

-- 5. TRIGGER: LIKE
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_post_author UUID; v_actor_name TEXT;
BEGIN
  v_post_author := get_post_author_id(NEW.post_id);
  IF v_post_author IS NULL OR v_post_author = NEW.user_id THEN RETURN NEW; END IF;
  v_actor_name := get_display_name(NEW.user_id);
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (v_post_author, 'like', 'New Like', v_actor_name || ' liked your post',
    jsonb_build_object('post_id', NEW.post_id, 'actor_id', NEW.user_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_like ON post_likes;
CREATE TRIGGER trg_notify_like AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- 6. TRIGGER: COMMENT
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_post_author UUID; v_actor_name TEXT;
BEGIN
  v_post_author := get_post_author_id(NEW.post_id);
  IF v_post_author IS NULL OR v_post_author = NEW.user_id THEN RETURN NEW; END IF;
  v_actor_name := get_display_name(NEW.user_id);
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (v_post_author, 'comment', 'New Comment', v_actor_name || ' commented on your post',
    jsonb_build_object('post_id', NEW.post_id, 'actor_id', NEW.user_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_comment ON post_comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- 7. TRIGGER: FOLLOW
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_actor_name TEXT;
BEGIN
  IF NEW.following_id = NEW.follower_id THEN RETURN NEW; END IF;
  v_actor_name := get_display_name(NEW.follower_id);
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (NEW.following_id, 'follow', 'New Follower', v_actor_name || ' followed you',
    jsonb_build_object('actor_id', NEW.follower_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_follow ON follows;
CREATE TRIGGER trg_notify_follow AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- 8. TRIGGER: REPOST/QUOTE
CREATE OR REPLACE FUNCTION public.notify_on_repost()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_parent_author UUID; v_actor_name TEXT; v_type TEXT; v_msg TEXT;
BEGIN
  IF NEW.parent_post_id IS NULL THEN RETURN NEW; END IF;
  v_parent_author := get_post_author_id(NEW.parent_post_id);
  IF v_parent_author IS NULL OR v_parent_author = NEW.user_id THEN RETURN NEW; END IF;
  v_actor_name := get_display_name(NEW.user_id);
  IF NEW.post_type = 'repost' THEN v_type := 'repost'; v_msg := v_actor_name || ' reposted your post';
  ELSIF NEW.post_type = 'quote' THEN v_type := 'quote'; v_msg := v_actor_name || ' quoted your post';
  ELSE RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (v_parent_author, v_type, 'New ' || initcap(v_type), v_msg,
    jsonb_build_object('post_id', NEW.id, 'parent_post_id', NEW.parent_post_id, 'actor_id', NEW.user_id));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_repost ON posts;
CREATE TRIGGER trg_notify_repost AFTER INSERT ON posts FOR EACH ROW
  WHEN (NEW.post_type IN ('repost', 'quote'))
  EXECUTE FUNCTION notify_on_repost();

-- 9. TRIGGER: MENTION
CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_actor_name TEXT; v_mentioned_id UUID; v_username_match TEXT;
BEGIN
  v_actor_name := get_display_name(NEW.user_id);
  FOR v_username_match IN
    SELECT (regexp_matches(NEW.content, '@([a-zA-Z0-9_]+)', 'g'))[1]
  LOOP
    SELECT id INTO v_mentioned_id FROM profiles WHERE lower(username) = lower(v_username_match) LIMIT 1;
    CONTINUE WHEN v_mentioned_id IS NULL;
    CONTINUE WHEN v_mentioned_id = NEW.user_id;
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (v_mentioned_id, 'mention', 'You were mentioned', v_actor_name || ' mentioned you',
      jsonb_build_object('post_id', NEW.id, 'actor_id', NEW.user_id))
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_mention ON posts;
CREATE TRIGGER trg_notify_mention AFTER INSERT ON posts FOR EACH ROW
  WHEN (NEW.post_type = 'tweet' AND NEW.content LIKE '%@%')
  EXECUTE FUNCTION notify_on_mention();
