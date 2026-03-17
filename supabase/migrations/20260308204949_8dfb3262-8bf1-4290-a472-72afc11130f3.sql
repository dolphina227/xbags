
-- Table: posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  is_locked BOOLEAN DEFAULT FALSE,
  unlock_price_sol DECIMAL DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: post_likes
CREATE TABLE public.post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Table: post_comments
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "User insert posts" ON public.posts FOR INSERT WITH CHECK (true);
CREATE POLICY "User update own posts" ON public.posts FOR UPDATE USING (true);
CREATE POLICY "User delete own posts" ON public.posts FOR DELETE USING (true);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public likes" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "User insert likes" ON public.post_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "User delete likes" ON public.post_likes FOR DELETE USING (true);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "User insert comments" ON public.post_comments FOR INSERT WITH CHECK (true);
