
-- Add parent_post_id and post_type to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS parent_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'tweet';

-- Index for efficient parent lookups
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON public.posts(parent_post_id) WHERE parent_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON public.posts(post_type);

-- Function to increment quotes count (reuse reposts_count for combined repost+quote count)
CREATE OR REPLACE FUNCTION public.increment_quotes(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE posts SET reposts_count = COALESCE(reposts_count, 0) + 1 WHERE id = p_post_id;
END;
$$;
