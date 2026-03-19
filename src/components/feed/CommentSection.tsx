import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Trash2, CornerDownRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { feedAPI, Comment } from "@/lib/api/feed";
import { useProfile } from "@/hooks/use-profile";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";
import { PostContent } from "@/components/feed/PostCard";

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
  alwaysOpen?: boolean;
  onCommentAdded: () => void;
  onCommentDeleted?: () => void;
}

export default function CommentSection({ postId, alwaysOpen, onCommentAdded, onCommentDeleted }: Props) {
  const { profile } = useProfile();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // username being replied to
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

  const handleReply = (username: string | null | undefined) => {
    const name = username || "user";
    const prefix = `@${name} `;
    setText(prefix);
    setReplyingTo(name);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(prefix.length, prefix.length);
      }
    }, 0);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className={`space-y-3 ${alwaysOpen ? "" : "max-h-60 overflow-y-auto"}`}>
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
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Reply button — visible on hover */}
                    {profile && (
                      <button
                        onClick={() => handleReply(c.author?.username)}
                        className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary transition-colors px-1.5 py-0.5 rounded"
                      >
                        <CornerDownRight className="h-2.5 w-2.5" />
                        Reply
                      </button>
                    )}
                    {/* Delete button — only for own comments */}
                    {profile?.id === c.user_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
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
                </div>
                <PostContent content={c.content} />
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
        <div className="mt-3">
          {/* Replying to indicator */}
          {replyingTo && (
            <div className="flex items-center gap-1.5 mb-1.5 px-1">
              <CornerDownRight className="h-3 w-3 text-primary" />
              <span className="text-[11px] text-muted-foreground">
                Replying to <span className="text-primary font-medium">@{replyingTo}</span>
              </span>
              <button
                onClick={() => { setReplyingTo(null); setText(""); }}
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <EmojiPicker onSelect={(emoji) => {
              setText((prev) => prev + emoji);
              inputRef.current?.focus();
            }} />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // Clear replyingTo if user deletes the @mention prefix
                if (replyingTo && !e.target.value.startsWith(`@${replyingTo}`)) {
                  setReplyingTo(null);
                }
              }}
              placeholder={replyingTo ? `Reply to @${replyingTo}...` : "Write a comment..."}
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
        </div>
      )}
    </div>
  );
}