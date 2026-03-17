
-- Add missing columns to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'none';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- Table: post_unlocks
CREATE TABLE IF NOT EXISTS public.post_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_wallet TEXT NOT NULL,
  amount_sol DECIMAL NOT NULL,
  transaction_signature TEXT UNIQUE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_wallet)
);

ALTER TABLE public.post_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public unlocks read" ON public.post_unlocks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unlocks" ON public.post_unlocks FOR INSERT WITH CHECK (true);

-- Enable realtime for posts
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
