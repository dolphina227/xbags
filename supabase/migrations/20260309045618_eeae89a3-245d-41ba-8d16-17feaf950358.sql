
-- Atomic increment/decrement for likes
CREATE OR REPLACE FUNCTION public.increment_likes(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_likes(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = p_post_id;
END;
$$;

-- Atomic increment/decrement for reposts
CREATE OR REPLACE FUNCTION public.increment_reposts(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET reposts_count = COALESCE(reposts_count, 0) + 1 WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_reposts(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET reposts_count = GREATEST(COALESCE(reposts_count, 0) - 1, 0) WHERE id = p_post_id;
END;
$$;

-- Atomic increment for comments
CREATE OR REPLACE FUNCTION public.increment_comments(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET comments_count = COALESCE(comments_count, 0) + 1 WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_comments(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0) WHERE id = p_post_id;
END;
$$;
