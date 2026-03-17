
-- Create reposts table
CREATE TABLE public.post_reposts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quote_content text DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reposts readable" ON public.post_reposts FOR SELECT USING (true);
CREATE POLICY "User can insert reposts" ON public.post_reposts FOR INSERT WITH CHECK (true);
CREATE POLICY "User can delete own reposts" ON public.post_reposts FOR DELETE USING (true);

-- Add reposts_count to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reposts_count integer DEFAULT 0;

-- Enable realtime for related tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reposts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
