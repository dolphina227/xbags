
-- Re-add the foreign key constraint for parent_post_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'posts_parent_post_id_fkey' 
    AND table_name = 'posts'
  ) THEN
    ALTER TABLE public.posts 
    ADD CONSTRAINT posts_parent_post_id_fkey 
    FOREIGN KEY (parent_post_id) REFERENCES public.posts(id) ON DELETE SET NULL;
  END IF;
END $$;
