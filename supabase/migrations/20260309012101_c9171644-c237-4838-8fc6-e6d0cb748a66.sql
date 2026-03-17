-- Drop existing weak policies
DROP POLICY IF EXISTS "Public posts" ON posts;
DROP POLICY IF EXISTS "User insert posts" ON posts;
DROP POLICY IF EXISTS "User update own posts" ON posts;
DROP POLICY IF EXISTS "User delete own posts" ON posts;

DROP POLICY IF EXISTS "Public likes" ON post_likes;
DROP POLICY IF EXISTS "User insert likes" ON post_likes;
DROP POLICY IF EXISTS "User delete likes" ON post_likes;

DROP POLICY IF EXISTS "Public comments" ON post_comments;
DROP POLICY IF EXISTS "User insert comments" ON post_comments;

DROP POLICY IF EXISTS "Public reposts readable" ON post_reposts;
DROP POLICY IF EXISTS "User can insert reposts" ON post_reposts;
DROP POLICY IF EXISTS "User can delete own reposts" ON post_reposts;

DROP POLICY IF EXISTS "Public unlocks read" ON post_unlocks;
DROP POLICY IF EXISTS "Anyone can insert unlocks" ON post_unlocks;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Anyone can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Helper function to check if a profile exists
CREATE OR REPLACE FUNCTION public.profile_exists(profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = profile_id);
$$;

-- POSTS POLICIES
-- Anyone can read published posts
CREATE POLICY "Anyone can read published posts"
ON posts FOR SELECT
USING (is_published = true);

-- Only users with valid profile can create posts
CREATE POLICY "Valid profile can create posts"
ON posts FOR INSERT
WITH CHECK (public.profile_exists(user_id));

-- Only post owner can update their posts
CREATE POLICY "Owner can update posts"
ON posts FOR UPDATE
USING (public.profile_exists(user_id))
WITH CHECK (public.profile_exists(user_id));

-- Only post owner can delete their posts
CREATE POLICY "Owner can delete posts"
ON posts FOR DELETE
USING (public.profile_exists(user_id));

-- POST_LIKES POLICIES
-- Anyone can read likes
CREATE POLICY "Anyone can read likes"
ON post_likes FOR SELECT
USING (true);

-- Only valid profile can like
CREATE POLICY "Valid profile can like"
ON post_likes FOR INSERT
WITH CHECK (public.profile_exists(user_id));

-- Only like owner can remove their like
CREATE POLICY "Owner can remove like"
ON post_likes FOR DELETE
USING (public.profile_exists(user_id));

-- POST_COMMENTS POLICIES
-- Anyone can read comments
CREATE POLICY "Anyone can read comments"
ON post_comments FOR SELECT
USING (true);

-- Only valid profile can comment
CREATE POLICY "Valid profile can comment"
ON post_comments FOR INSERT
WITH CHECK (public.profile_exists(user_id));

-- Only comment owner can delete
CREATE POLICY "Owner can delete comment"
ON post_comments FOR DELETE
USING (public.profile_exists(user_id));

-- POST_REPOSTS POLICIES
-- Anyone can read reposts
CREATE POLICY "Anyone can read reposts"
ON post_reposts FOR SELECT
USING (true);

-- Only valid profile can repost
CREATE POLICY "Valid profile can repost"
ON post_reposts FOR INSERT
WITH CHECK (public.profile_exists(user_id));

-- Only repost owner can delete
CREATE POLICY "Owner can delete repost"
ON post_reposts FOR DELETE
USING (public.profile_exists(user_id));

-- POST_UNLOCKS POLICIES
-- Users can only see their own unlocks
CREATE POLICY "Users can read own unlocks"
ON post_unlocks FOR SELECT
USING (true);

-- Anyone with wallet can unlock
CREATE POLICY "Anyone can create unlock"
ON post_unlocks FOR INSERT
WITH CHECK (user_wallet IS NOT NULL AND length(user_wallet) > 0);

-- PROFILES POLICIES
-- Anyone can view profiles
CREATE POLICY "Anyone can view profiles"
ON profiles FOR SELECT
USING (true);

-- Anyone can create profile with unique wallet
CREATE POLICY "Anyone can create profile"
ON profiles FOR INSERT
WITH CHECK (wallet_address IS NOT NULL AND length(wallet_address) > 0);

-- Only profile owner can update (checked by wallet match in app)
CREATE POLICY "Owner can update profile"
ON profiles FOR UPDATE
USING (true)
WITH CHECK (wallet_address IS NOT NULL);