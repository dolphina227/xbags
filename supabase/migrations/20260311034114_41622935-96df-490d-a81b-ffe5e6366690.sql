
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Valid profile can follow" ON public.follows FOR INSERT WITH CHECK (profile_exists(follower_id));
CREATE POLICY "Owner can unfollow" ON public.follows FOR DELETE USING (profile_exists(follower_id));

-- Add followers/following counters to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS followers_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS following_count integer NOT NULL DEFAULT 0;

-- Increment/decrement functions for follow counts
CREATE OR REPLACE FUNCTION public.increment_followers(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET followers_count = COALESCE(followers_count, 0) + 1 WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_followers(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0) WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_following(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET following_count = COALESCE(following_count, 0) + 1 WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_following(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0) WHERE id = p_user_id;
END;
$$;

-- Enable realtime for follows
ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
