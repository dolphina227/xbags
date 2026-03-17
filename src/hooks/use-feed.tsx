import { useState, useEffect, useCallback, useRef } from "react";
import { feedAPI, Post } from "@/lib/api/feed";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

type FeedTab = "home" | "recent" | "popular" | "following";

export function useFeed(tab: FeedTab) {
  const { profile } = useProfile();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const mountedRef = useRef(true);

  const fetchFeed = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const result = await feedAPI.getFeed(tab, pageNum, 20, profile?.id);
        if (!mountedRef.current) return;

        const combinedPosts: Post[] = result.posts.map((p) => ({
          ...p,
          sort_time: p.sort_time || p.created_at,
        }));

        if (append) {
          setPosts((prev) => [...prev, ...combinedPosts]);
        } else {
          setPosts(combinedPosts);
        }
        setHasMore(result.hasMore);
        setPage(pageNum);
      } catch (err) {
        console.error("Feed fetch error:", err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [tab, profile?.id]
  );

  useEffect(() => {
    mountedRef.current = true;
    fetchFeed(1);
    return () => {
      mountedRef.current = false;
    };
  }, [fetchFeed]);

  // Realtime subscriptions
  useEffect(() => {
    const postsChannel = supabase
      .channel("posts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) => {
        if (payload.new && (payload.new as any).is_published) {
          fetchFeed(1);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, (payload) => {
        if (payload.new) {
          const updated = payload.new as any;
          setPosts((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? {
                    ...p,
                    likes_count: updated.likes_count ?? p.likes_count,
                    comments_count: updated.comments_count ?? p.comments_count,
                    shares_count: updated.shares_count ?? p.shares_count,
                    reposts_count: updated.reposts_count ?? p.reposts_count,
                    views_count: updated.views_count ?? p.views_count,
                  }
                : p
            )
          );
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload) => {
        if (payload.old) {
          setPosts((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    const likesChannel = supabase
      .channel("likes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, (payload) => {
        const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
        if (postId) {
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                const delta = payload.eventType === "INSERT" ? 1 : payload.eventType === "DELETE" ? -1 : 0;
                return { ...p, likes_count: Math.max(0, p.likes_count + delta) };
              }
              return p;
            })
          );
        }
      })
      .subscribe();

    const repostsChannel = supabase
      .channel("reposts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reposts" }, (payload) => {
        const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
        if (postId) {
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                const delta = payload.eventType === "INSERT" ? 1 : payload.eventType === "DELETE" ? -1 : 0;
                return { ...p, reposts_count: Math.max(0, (p.reposts_count || 0) + delta) };
              }
              return p;
            })
          );
        }
      })
      .subscribe();

    const commentsChannel = supabase
      .channel("comments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, (payload) => {
        const postId = (payload.new as any)?.post_id || (payload.old as any)?.post_id;
        if (postId) {
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === postId) {
                const delta = payload.eventType === "INSERT" ? 1 : payload.eventType === "DELETE" ? -1 : 0;
                return { ...p, comments_count: Math.max(0, p.comments_count + delta) };
              }
              return p;
            })
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(repostsChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [fetchFeed]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchFeed(page + 1, true);
    }
  }, [loadingMore, hasMore, page, fetchFeed]);

  const refresh = useCallback(() => fetchFeed(1), [fetchFeed]);

  const addPost = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const updatePostInList = useCallback((postId: string, updates: Partial<Post>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updates } : p))
    );
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    fetchFeed: refresh,
    loadMore,
    refresh,
    addPost,
    updatePostInList,
    removePost,
  };
}
