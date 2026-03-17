import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import FeedTabs from "@/components/feed/FeedTabs";
import CreatePost from "@/components/feed/CreatePost";
import PostCard from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";
import { useFeed } from "@/hooks/use-feed";

type FeedTab = "home" | "recent" | "popular" | "following";

const FeedPage = () => {
  const [activeTab, setActiveTab] = useState<FeedTab>("home");
  const { posts, loading, loadingMore, hasMore, loadMore, addPost, updatePostInList, removePost } =
    useFeed(activeTab);
  const observerRef = useRef<HTMLDivElement>(null);

  // Infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore();
      }
    },
    [hasMore, loadingMore, loadMore]
  );

  useEffect(() => {
    const el = observerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div>
      <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <CreatePost onPostCreated={addPost} />

      {loading ? (
        <div>
          {[...Array(5)].map((_, i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-foreground mb-1">No posts yet</p>
          <p className="text-sm text-muted-foreground">Be the first to share something!</p>
        </div>
      ) : (
        <>
          {posts.map((post, i) => (
            <PostCard
              key={post.id}
              post={post}
              onUpdate={updatePostInList}
              onDelete={removePost}
              index={i}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={observerRef} className="py-4 flex justify-center">
            {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            {!hasMore && posts.length > 0 && (
              <p className="text-xs text-muted-foreground">You've reached the end</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FeedPage;
