import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, MessageCircle, Share2, Eye, MoreHorizontal,
  Trash2, Diamond, Repeat2, Link2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Post, feedAPI } from "@/lib/api/feed";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CommentSection from "./CommentSection";
import TipModal from "./TipModal";
import QuoteModal from "./QuoteModal";
import EmbeddedPost from "./EmbeddedPost";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n > 0 ? String(n) : "";
}

function getSessionId(): string {
  const KEY = "xbags_sid";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

interface PostCardProps {
  post: Post;
  onUpdate: (postId: string, updates: Partial<Post>) => void;
  onDelete: (postId: string) => void;
  index: number;
}

export default function PostCard({ post, onUpdate, onDelete, index }: PostCardProps) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // View tracking refs
  const cardRef = useRef<HTMLDivElement>(null);
  const didTrack = useRef(false);

  const isRepost = post.post_type === "repost" && !!post.parent_post;
  const isQuote = post.post_type === "quote" && !!post.parent_post;
  const isOrphanRepost = post.post_type === "repost" && !post.parent_post;
  const displayPost = isRepost ? post.parent_post! : post;

  const isOwn = profile?.id === post.user_id;
  const displayName = isOrphanRepost ? "Unknown" : (displayPost.author?.display_name || displayPost.author?.username || "Anonymous");
  const username = isOrphanRepost ? "" : (displayPost.author?.username ? `@${displayPost.author.username}` : "");
  const contentLong = !isRepost && !isOrphanRepost && displayPost.content.length > 200;
  const repostAuthorName = post.author?.display_name || post.author?.username || "Someone";

  const targetPostId = isRepost ? post.parent_post!.id : post.id;

  // IntersectionObserver-based view tracking with deduplication
  useEffect(() => {
    if (isOrphanRepost) return;
    const cacheKey = `vw_${displayPost.id}`;
    if (sessionStorage.getItem(cacheKey)) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || didTrack.current) return;
        didTrack.current = true;
        sessionStorage.setItem(cacheKey, "1");
        obs.disconnect();

        supabase.rpc("increment_post_view" as any, {
          p_post_id: displayPost.id,
          p_viewer_id: profile?.id ?? null,
          p_session_id: profile?.id ? null : getSessionId(),
        }).then(() => {
          onUpdate(displayPost.id, { views_count: displayPost.views_count + 1 });
        });
      },
      { threshold: 0.6 }
    );

    if (cardRef.current) obs.observe(cardRef.current);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPost.id, isOrphanRepost]);

  if (isOrphanRepost) return null;

  const handleLike = async () => {
    if (!profile) return toast.error("Connect wallet first");
    if (liking) return;
    setLiking(true);
    try {
      const nowLiked = await feedAPI.toggleLike(targetPostId, profile.id, !!displayPost.is_liked);
      onUpdate(targetPostId, {
        is_liked: nowLiked,
        likes_count: nowLiked ? displayPost.likes_count + 1 : Math.max(0, displayPost.likes_count - 1),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLiking(false);
    }
  };

  const handleRepost = async () => {
    if (!profile) return toast.error("Connect wallet first");
    if (reposting) return;
    setReposting(true);
    try {
      const result = await feedAPI.createRepost(targetPostId, profile.id);
      onUpdate(targetPostId, {
        is_reposted: result.reposted,
        reposts_count: result.reposted ? (displayPost.reposts_count || 0) + 1 : Math.max(0, (displayPost.reposts_count || 0) - 1),
      });
      toast.success(result.reposted ? "Reposted!" : "Repost removed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to repost");
    } finally {
      setReposting(false);
    }
  };

  const handleQuote = async (quoteContent: string): Promise<void> => {
    if (!profile) {
      toast.error("Connect wallet first");
      return;
    }
    await feedAPI.createQuote(targetPostId, profile.id, quoteContent);
    onUpdate(targetPostId, { reposts_count: (displayPost.reposts_count || 0) + 1 });
    toast.success("Quote posted!");
  };

  const handleDelete = async () => {
    try {
      await feedAPI.deletePost(post.id);
      onDelete(post.id);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${targetPostId}`;
    await navigator.clipboard.writeText(url);
    await feedAPI.incrementShares(targetPostId);
    toast.success("Link copied!");
    onUpdate(targetPostId, { shares_count: displayPost.shares_count + 1 });
  };

  const handleShareToX = async () => {
    const postUrl = `${window.location.origin}/post/${targetPostId}`;
    const text = encodeURIComponent("Check out this post on xbags.social! 🎒");
    const url = encodeURIComponent(postUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
    await feedAPI.incrementShares(targetPostId);
    onUpdate(targetPostId, { shares_count: displayPost.shares_count + 1 });
  };

  return (
    <>
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03, duration: 0.3 }}
        className="px-4 py-4 hover:bg-muted/30 transition-colors border-b border-border cursor-pointer"
      >
        {isRepost && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 ml-12">
            <Repeat2 className="h-3.5 w-3.5" />
            <span>{repostAuthorName} reposted</span>
          </div>
        )}

        <div className="flex gap-3">
          <Avatar
            className="h-10 w-10 shrink-0 ring-2 ring-transparent hover:ring-primary/30 transition-all cursor-pointer"
            onClick={() => displayPost.author?.username && navigate(`/profile/${displayPost.author.username}`)}
          >
            <AvatarImage src={displayPost.author?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
              {displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-sm text-foreground truncate">{displayName}</span>
                <span className="text-sm text-muted-foreground truncate">{username}</span>
                <span className="text-xs text-muted-foreground" title={formatDate(displayPost.created_at)}>· {timeAgo(displayPost.created_at)}</span>
              </div>
              {isOwn && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete Post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div onClick={() => navigate(`/post/${targetPostId}`)} className="cursor-pointer">
              {isQuote && (
                <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-line">
                  {contentLong && !expanded ? `${post.content.slice(0, 200)}...` : post.content}
                </p>
              )}
              {!isQuote && (
                <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-line">
                  {contentLong && !expanded ? `${displayPost.content.slice(0, 200)}...` : displayPost.content}
                </p>
              )}
              {contentLong && (
                <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="text-xs text-primary mt-1 hover:underline">
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>

            {isQuote && post.parent_post && <EmbeddedPost post={post.parent_post} />}

            <p className="text-[11px] text-muted-foreground mt-1.5">{formatDate(displayPost.created_at)}</p>

            {displayPost.media_urls && displayPost.media_urls.length > 0 && (
              <div className="mt-2 rounded-xl overflow-hidden border border-border">
                {displayPost.media_type === "video" ? (
                  <video src={displayPost.media_urls[0]} controls className="w-full max-h-80 object-cover" />
                ) : (
                  <div className={`grid gap-0.5 ${displayPost.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {displayPost.media_urls.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-full max-h-80 object-cover" loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 -ml-2">
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="gap-1.5 text-muted-foreground hover:text-primary text-xs h-8 px-2 group">
                  <div className="p-1 rounded-full group-hover:bg-primary/10 transition-colors"><MessageCircle className="h-3.5 w-3.5" /></div>
                  <span>{formatCount(displayPost.comments_count)}</span>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={reposting} className={`gap-1.5 text-xs h-8 px-2 group ${displayPost.is_reposted ? "text-primary" : "text-muted-foreground hover:text-primary"}`}>
                      <div className={`p-1 rounded-full transition-colors ${displayPost.is_reposted ? "bg-primary/10" : "group-hover:bg-primary/10"}`}><Repeat2 className="h-3.5 w-3.5" /></div>
                      <span>{formatCount(displayPost.reposts_count || 0)}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuItem onClick={handleRepost}><Repeat2 className="h-4 w-4 mr-2" />{displayPost.is_reposted ? "Undo Repost" : "Repost"}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowQuoteModal(true)}><MessageCircle className="h-4 w-4 mr-2" />Quote Tweet</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="ghost" size="sm" onClick={handleLike} disabled={liking} className={`gap-1.5 text-xs h-8 px-2 group ${displayPost.is_liked ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}>
                  <motion.div className={`p-1 rounded-full transition-colors ${displayPost.is_liked ? "bg-destructive/10" : "group-hover:bg-destructive/10"}`} whileTap={{ scale: 1.4 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                    <Heart className={`h-3.5 w-3.5 ${displayPost.is_liked ? "fill-current" : ""}`} />
                  </motion.div>
                  <AnimatePresence mode="wait">
                    <motion.span key={displayPost.likes_count} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} transition={{ duration: 0.15 }}>
                      {formatCount(displayPost.likes_count)}
                    </motion.span>
                  </AnimatePresence>
                </Button>

                {!isOwn && displayPost.author?.wallet_address && (
                  <Button variant="ghost" size="sm" onClick={() => setShowTipModal(true)} className="gap-1.5 text-muted-foreground hover:text-warning text-xs h-8 px-2 group">
                    <div className="p-1 rounded-full group-hover:bg-warning/10 transition-colors"><Diamond className="h-3.5 w-3.5" /></div>
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary text-xs h-8 px-2 group">
                      <div className="p-1 rounded-full group-hover:bg-primary/10 transition-colors"><Share2 className="h-3.5 w-3.5" /></div>
                      <span>{formatCount(displayPost.shares_count)}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuItem onClick={handleShareToX}><ExternalLink className="h-4 w-4 mr-2" />Share to X</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleCopyLink}><Link2 className="h-4 w-4 mr-2" />Copy Link</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <span className="flex items-center gap-1 text-xs text-muted-foreground pr-1">
                <Eye className="h-3 w-3" />
                <AnimatePresence mode="wait">
                  <motion.span key={displayPost.views_count} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                    {formatCount(displayPost.views_count)}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>

            <AnimatePresence>
              {showComments && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <CommentSection
                    postId={targetPostId}
                    onCommentAdded={() => onUpdate(targetPostId, { comments_count: displayPost.comments_count + 1 })}
                    onCommentDeleted={() => onUpdate(targetPostId, { comments_count: Math.max(0, displayPost.comments_count - 1) })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {showTipModal && displayPost.author && (
        <TipModal isOpen={showTipModal} onClose={() => setShowTipModal(false)} recipientWallet={displayPost.author.wallet_address} recipientName={displayName} recipientUsername={displayPost.author.username} />
      )}

      {showQuoteModal && (
        <QuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} onQuote={handleQuote} originalPost={{ content: displayPost.content, author: displayPost.author }} />
      )}
    </>
  );
}
