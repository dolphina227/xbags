import { supabase } from "@/integrations/supabase/client";

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  media_type: string;
  is_locked: boolean;
  unlock_price_sol: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reposts_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  post_type: "tweet" | "repost" | "quote";
  parent_post_id: string | null;
  author?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    wallet_address: string;
  };
  parent_post?: Post;
  is_liked?: boolean;
  is_reposted?: boolean;
  is_unlocked?: boolean;
  sort_time?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: {
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

const PROFILE_SELECT = "id, username, display_name, avatar_url, wallet_address";
const POST_WITH_AUTHOR = `*, profiles!posts_user_id_fkey(${PROFILE_SELECT})`;

function mapPost(p: any): Post {
  return {
    ...p,
    media_urls: p.media_urls || [],
    reposts_count: p.reposts_count || 0,
    post_type: p.post_type || "tweet",
    parent_post_id: p.parent_post_id || null,
    author: p.profiles || undefined,
    parent_post: undefined,
  };
}

/** Fetch parent posts for any posts that have parent_post_id, and attach them */
async function attachParentPosts(posts: Post[]): Promise<Post[]> {
  const parentIds = [...new Set(posts.filter(p => p.parent_post_id).map(p => p.parent_post_id!))];
  if (parentIds.length === 0) return posts;

  const { data: parentData } = await supabase
    .from("posts")
    .select(POST_WITH_AUTHOR)
    .in("id", parentIds);

  const parentMap = new Map<string, Post>();
  (parentData || []).forEach((p: any) => {
    parentMap.set(p.id, mapPost(p));
  });

  return posts.map(post => {
    if (post.parent_post_id && parentMap.has(post.parent_post_id)) {
      return { ...post, parent_post: parentMap.get(post.parent_post_id) };
    }
    return post;
  });
}

export const feedAPI = {
  // ─── FEED ──────────────────────────────────────────────
  async getFeed(
    tab: "home" | "recent" | "popular" | "following",
    page: number = 1,
    limit: number = 20,
    currentUserProfileId?: string
  ) {
    let query = supabase
      .from("posts")
      .select(POST_WITH_AUTHOR)
      .eq("is_published", true);

    // For "following" tab, fetch only posts from followed users
    if (tab === "following" && currentUserProfileId) {
      const followingIds = await this.getFollowingIds(currentUserProfileId);
      if (followingIds.length === 0) {
        return { posts: [], hasMore: false };
      }
      query = query.in("user_id", followingIds);
    }

    query = query.range((page - 1) * limit, page * limit - 1);

    switch (tab) {
      case "popular":
        query = query.order("likes_count", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;

    let posts: Post[] = (data || []).map(mapPost);
    posts = await attachParentPosts(posts);

    if (currentUserProfileId && posts.length > 0) {
      const postIds = posts.map((p) => p.id);

      const [likesRes, repostsRes] = await Promise.all([
        supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", postIds)
          .eq("user_id", currentUserProfileId),
        supabase
          .from("post_reposts")
          .select("post_id")
          .in("post_id", postIds)
          .eq("user_id", currentUserProfileId),
      ]);

      const likedSet = new Set((likesRes.data || []).map((l: any) => l.post_id));
      const repostedSet = new Set((repostsRes.data || []).map((r: any) => r.post_id));

      posts.forEach((p) => {
        p.is_liked = likedSet.has(p.id);
        p.is_reposted = repostedSet.has(p.id);
      });

      const lockedIds = postIds.filter((id) => posts.find((p) => p.id === id)?.is_locked);
      if (lockedIds.length > 0) {
        const { data: unlocks } = await supabase
          .from("post_unlocks")
          .select("post_id")
          .in("post_id", lockedIds);
        const unlockedSet = new Set((unlocks || []).map((u: any) => u.post_id));
        posts.forEach((p) => {
          if (p.is_locked) p.is_unlocked = unlockedSet.has(p.id);
        });
      }
    }

    return { posts, hasMore: (data || []).length === limit };
  },

  // ─── CREATE POST ───────────────────────────────────────
  async createPost(
    userId: string,
    content: string,
    mediaUrls: string[] = [],
    mediaType: string = "none",
    isLocked: boolean = false,
    unlockPrice: number = 0,
    scheduledAt?: string
  ) {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content,
        media_urls: mediaUrls,
        media_type: mediaType,
        is_locked: isLocked,
        unlock_price_sol: unlockPrice,
        post_type: "tweet",
        ...(scheduledAt ? { scheduled_at: scheduledAt, is_published: false } : {}),
      } as any)
      .select(POST_WITH_AUTHOR)
      .single();

    if (error) throw error;
    return mapPost(data);
  },

  // ─── REPOST ─────────────────────────────────────────────
  async createRepost(originalPostId: string, userId: string) {
    const { data: existing } = await supabase
      .from("posts")
      .select("id")
      .eq("user_id", userId)
      .eq("parent_post_id", originalPostId)
      .eq("post_type", "repost" as any)
      .maybeSingle();

    if (existing) {
      await supabase.from("posts").delete().eq("id", existing.id);
      await supabase.rpc("decrement_reposts" as any, { p_post_id: originalPostId });
      return { reposted: false };
    }

    const { error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: "",
        parent_post_id: originalPostId,
        post_type: "repost",
        is_published: true,
      } as any);

    if (error) throw error;
    await supabase.rpc("increment_reposts" as any, { p_post_id: originalPostId });
    return { reposted: true };
  },

  // ─── QUOTE TWEET ────────────────────────────────────────
  async createQuote(originalPostId: string, userId: string, quoteContent: string) {
    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        content: quoteContent,
        parent_post_id: originalPostId,
        post_type: "quote",
        is_published: true,
      } as any)
      .select(POST_WITH_AUTHOR)
      .single();

    if (error) throw error;
    await supabase.rpc("increment_reposts" as any, { p_post_id: originalPostId });

    let post = mapPost(data);
    const posts = await attachParentPosts([post]);
    return posts[0];
  },

  // ─── LIKE / UNLIKE ─────────────────────────────────────
  async toggleLike(postId: string, userId: string, currentlyLiked: boolean) {
    if (currentlyLiked) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.rpc("decrement_likes" as any, { p_post_id: postId });
      return false;
    } else {
      const { error } = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: userId } as any);
      if (error) {
        if (error.code === "23505") return true;
        throw error;
      }
      await supabase.rpc("increment_likes" as any, { p_post_id: postId });
      return true;
    }
  },

  // ─── LEGACY REPOST TOGGLE ──────────────────────────────
  async toggleRepost(postId: string, userId: string, currentlyReposted: boolean) {
    if (currentlyReposted) {
      const { error } = await supabase
        .from("post_reposts")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.rpc("decrement_reposts" as any, { p_post_id: postId });
      return false;
    } else {
      const { error } = await supabase
        .from("post_reposts")
        .insert({ post_id: postId, user_id: userId } as any);
      if (error) {
        if (error.code === "23505") return true;
        throw error;
      }
      await supabase.rpc("increment_reposts" as any, { p_post_id: postId });
      return true;
    }
  },

  // ─── QUOTE TWEET (legacy) ──────────────────────────────
  async quoteRetweet(postId: string, userId: string, quoteText: string) {
    const { error } = await supabase
      .from("post_reposts")
      .insert({
        post_id: postId,
        user_id: userId,
        quote_content: quoteText,
      } as any);
    if (error) {
      if (error.code === "23505") throw new Error("Already quoted this post");
      throw error;
    }
    await supabase.rpc("increment_reposts" as any, { p_post_id: postId });
  },

  // ─── COMMENTS ──────────────────────────────────────────
  async getComments(postId: string) {
    const { data, error } = await supabase
      .from("post_comments")
      .select("*, profiles!post_comments_user_id_fkey(username, display_name, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map((c: any) => ({
      ...c,
      author: c.profiles || undefined,
    })) as Comment[];
  },

  async addComment(postId: string, userId: string, content: string) {
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: userId, content } as any)
      .select("*, profiles!post_comments_user_id_fkey(username, display_name, avatar_url)")
      .single();

    if (error) throw error;
    await supabase.rpc("increment_comments" as any, { p_post_id: postId });
    return { ...data, author: (data as any).profiles } as Comment;
  },

  async deleteComment(commentId: string, postId: string) {
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
    if (error) throw error;
    await supabase.rpc("decrement_comments" as any, { p_post_id: postId });
  },

  // ─── DELETE POST ───────────────────────────────────────
  async deletePost(postId: string) {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) throw error;
  },

  // ─── VIEWS & SHARES ───────────────────────────────────
  async incrementViews(postId: string) {
    await supabase.rpc("increment_views" as any, { post_id: postId });
  },

  async incrementShares(postId: string) {
    const { data } = await supabase.from("posts").select("shares_count").eq("id", postId).single();
    if (data) {
      await supabase.from("posts").update({ shares_count: (data.shares_count || 0) + 1 } as any).eq("id", postId);
    }
  },

  // ─── MEDIA UPLOAD ──────────────────────────────────────
  async uploadMedia(file: File, userId: string) {
    const ext = file.name.split(".").pop();
    const path = `posts/${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return urlData.publicUrl;
  },

  // ─── UNLOCK ────────────────────────────────────────────
  async recordUnlock(postId: string, userWallet: string, amountSol: number, signature: string) {
    const { error } = await supabase
      .from("post_unlocks")
      .insert({
        post_id: postId,
        user_wallet: userWallet,
        amount_sol: amountSol,
        transaction_signature: signature,
      } as any);
    if (error) throw error;
  },

  // ─── GET USER REPOSTS ─────────────────────────────────
  async getUserReposts(userId: string) {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_WITH_AUTHOR)
      .eq("user_id", userId)
      .in("post_type", ["repost", "quote"] as any)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    let posts = (data || []).map(mapPost);
    posts = await attachParentPosts(posts);
    return posts;
  },

  // ─── GET SINGLE POST ──────────────────────────────────
  async getPost(postId: string, currentUserProfileId?: string): Promise<Post | null> {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_WITH_AUTHOR)
      .eq("id", postId)
      .eq("is_published", true)
      .single();

    if (error) return null;

    let post = mapPost(data);
    const posts = await attachParentPosts([post]);
    post = posts[0];

    if (currentUserProfileId) {
      const [likesRes, repostsRes] = await Promise.all([
        supabase.from("post_likes").select("id").eq("post_id", postId).eq("user_id", currentUserProfileId).maybeSingle(),
        supabase.from("post_reposts").select("id").eq("post_id", postId).eq("user_id", currentUserProfileId).maybeSingle(),
      ]);
      post.is_liked = !!likesRes.data;
      post.is_reposted = !!repostsRes.data;
    }

    return post;
  },

  // ─── GET USER POSTS (all types like Twitter) ───────────
  async getUserPosts(userId: string) {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_WITH_AUTHOR)
      .eq("user_id", userId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    let posts = (data || []).map(mapPost);
    posts = await attachParentPosts(posts);
    return posts;
  },

  // ─── GET USER LIKED POSTS ─────────────────────────────
  async getUserLikedPosts(userId: string) {
    const { data: likes, error: likesError } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (likesError) throw likesError;
    if (!likes || likes.length === 0) return [];

    const postIds = likes.map((l: any) => l.post_id);
    const { data, error } = await supabase
      .from("posts")
      .select(POST_WITH_AUTHOR)
      .in("id", postIds)
      .eq("is_published", true);

    if (error) throw error;
    let posts = (data || []).map(mapPost);
    posts = await attachParentPosts(posts);
    // Preserve the order from likes (most recent like first)
    const orderMap = new Map(postIds.map((id: string, i: number) => [id, i]));
    posts.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    posts.forEach(p => { p.is_liked = true; });
    return posts;
  },

  // ─── GET USER REPLIES (comments) ──────────────────────
  async getUserReplies(userId: string) {
    const { data, error } = await supabase
      .from("post_comments")
      .select("*, profiles!post_comments_user_id_fkey(username, display_name, avatar_url), posts!post_comments_post_id_fkey(*, profiles!posts_user_id_fkey(id, username, display_name, avatar_url, wallet_address))")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data || []).map((c: any) => ({
      ...c,
      author: c.profiles || undefined,
      post: c.posts ? mapPost(c.posts) : undefined,
    }));
  },

  // ─── GET USER MEDIA POSTS ────────────────────────────
  async getUserMediaPosts(userId: string) {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_WITH_AUTHOR)
      .eq("user_id", userId)
      .eq("is_published", true)
      .neq("media_type", "none")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    let posts = (data || []).map(mapPost);
    posts = posts.filter(p => p.media_urls && p.media_urls.length > 0 && p.media_urls[0] !== "");
    return posts;
  },

  // ─── FOLLOW / UNFOLLOW ────────────────────────────────
  async followUser(followerId: string, followingId: string) {
    const { error } = await supabase
      .from("follows" as any)
      .insert({ follower_id: followerId, following_id: followingId } as any);
    if (error) {
      if (error.code === "23505") return; // already following
      throw error;
    }
    await Promise.all([
      supabase.rpc("increment_followers" as any, { p_user_id: followingId }),
      supabase.rpc("increment_following" as any, { p_user_id: followerId }),
    ]);
  },

  async unfollowUser(followerId: string, followingId: string) {
    const { error } = await supabase
      .from("follows" as any)
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
    if (error) throw error;
    await Promise.all([
      supabase.rpc("decrement_followers" as any, { p_user_id: followingId }),
      supabase.rpc("decrement_following" as any, { p_user_id: followerId }),
    ]);
  },

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const { data } = await supabase
      .from("follows" as any)
      .select("id")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();
    return !!data;
  },

  async getFollowingIds(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from("follows" as any)
      .select("following_id")
      .eq("follower_id", userId);
    return (data || []).map((f: any) => f.following_id);
  },

  async getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
    const { data } = await supabase
      .from("profiles")
      .select("followers_count, following_count")
      .eq("id", userId)
      .single();
    return {
      followers: (data as any)?.followers_count || 0,
      following: (data as any)?.following_count || 0,
    };
  },
};
