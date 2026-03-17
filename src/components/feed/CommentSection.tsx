import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { feedAPI, Comment } from "@/lib/api/feed";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface Props {
  postId: string;
  onCommentAdded: () => void;
  onCommentDeleted?: () => void;
}

export default function CommentSection({ postId, onCommentAdded, onCommentDeleted }: Props) {
  const { profile } = useProfile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    feedAPI.getComments(postId).then((c) => {
      setComments(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async () => {
    if (!text.trim() || !profile) return;
    setSubmitting(true);
    try {
      const comment = await feedAPI.addComment(postId, profile.id, text.trim());
      setComments((prev) => [...prev, comment]);
      setText("");
      onCommentAdded();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      await feedAPI.deleteComment(commentId, postId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCommentDeleted?.();
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 group">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={c.author?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-muted">
                  {(c.author?.display_name || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">
                    {c.author?.display_name || c.author?.username || "Anonymous"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                  {profile?.id === c.user_id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-foreground/80 mt-0.5">{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>
          )}
        </div>
      )}

      {/* Input */}
      {profile && (
        <div className="flex items-center gap-1 mt-3">
          <EmojiPicker onSelect={(emoji) => {
            setText((prev) => prev + emoji);
            inputRef.current?.focus();
          }} />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 bg-muted rounded-full px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="h-7 w-7 text-primary"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      )}
    </div>
  );
}
