
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON public.posts(scheduled_at) WHERE scheduled_at IS NOT NULL AND is_published = false;
