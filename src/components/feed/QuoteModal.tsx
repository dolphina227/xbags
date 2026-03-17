import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuote: (content: string) => Promise<void>;
  originalPost: {
    content: string;
    author?: {
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    };
  };
}

export default function QuoteModal({ isOpen, onClose, onQuote, originalPost }: QuoteModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const displayName = originalPost.author?.display_name || originalPost.author?.username || "Anonymous";

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await onQuote(content);
      setContent("");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quote Tweet</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Textarea
            placeholder="Add your comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[80px] resize-none"
            maxLength={280}
          />
          
          {/* Original post preview */}
          <div className="p-3 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={originalPost.author?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{displayName[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{displayName}</span>
              {originalPost.author?.username && (
                <span className="text-xs text-muted-foreground">@{originalPost.author.username}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">{originalPost.content}</p>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{content.length}/280</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={!content.trim() || loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Quote
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
