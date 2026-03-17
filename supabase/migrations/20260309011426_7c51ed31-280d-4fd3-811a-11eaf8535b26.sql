CREATE OR REPLACE FUNCTION public.increment_views(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts 
  SET views_count = COALESCE(views_count, 0) + 1 
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;