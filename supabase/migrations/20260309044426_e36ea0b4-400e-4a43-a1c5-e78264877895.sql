
-- Add unique constraint on post_likes to prevent double likes
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_unique_user_post UNIQUE (post_id, user_id);

-- Add unique constraint on post_reposts to prevent double reposts
ALTER TABLE public.post_reposts ADD CONSTRAINT post_reposts_unique_user_post UNIQUE (post_id, user_id);
