import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Post } from "@/lib/api/feed";

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

interface EmbeddedPostProps {
  post: Post;
}

export default function EmbeddedPost({ post }: EmbeddedPostProps) {
  const navigate = useNavigate();
  const displayName = post.author?.display_name || post.author?.username || "Anonymous";
  const username = post.author?.username ? `@${post.author.username}` : "";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/post/${post.id}`);
      }}
      className="mt-2 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar className="h-5 w-5">
          <AvatarImage src={post.author?.avatar_url || undefined} />
          <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
            {displayName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
        <span className="text-xs text-muted-foreground truncate">{username}</span>
        <span className="text-xs text-muted-foreground">· {timeAgo(post.created_at)}</span>
      </div>
      <p className="text-sm text-foreground/80 whitespace-pre-line line-clamp-4">{post.content}</p>
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="mt-2 rounded-lg overflow-hidden border border-border">
          <img src={post.media_urls[0]} alt="" className="w-full max-h-48 object-cover" loading="lazy" />
        </div>
      )}
    </div>
  );
}
