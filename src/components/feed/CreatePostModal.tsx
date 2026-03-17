import { useState, useRef } from "react";
import { X, ImagePlus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/use-profile";
import { useWallet } from "@/hooks/use-wallet";
import { feedAPI } from "@/lib/api/feed";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";
import { useNavigate } from "react-router-dom";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ open, onClose }: CreatePostModalProps) {
  const { profile } = useProfile();
  const { status } = useWallet();
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxChars = 280;
  const remaining = maxChars - content.length;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = [...mediaFiles, ...files].slice(0, 4);
    setMediaFiles(newFiles);
    setMediaPreviews(newFiles.map((f) => URL.createObjectURL(f)));
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEmojiSelect = (emoji: string) => {
    if (content.length + emoji.length <= maxChars) {
      setContent((prev) => prev + emoji);
    }
  };

  const handlePost = async () => {
    if (!content.trim() || !profile) return;
    setPosting(true);
    try {
      let mediaUrls: string[] = [];
      for (const file of mediaFiles) {
        const url = await feedAPI.uploadMedia(file, profile.id);
        mediaUrls.push(url);
      }
      const mediaType = mediaFiles.length > 0
        ? (mediaFiles[0].type.startsWith("video") ? "video" : "image")
        : "none";

      await feedAPI.createPost(profile.id, content.trim(), mediaUrls, mediaType, false, 0);
      toast.success("Post created! 🎉");
      setContent("");
      setMediaFiles([]);
      setMediaPreviews([]);
      onClose();
      navigate("/");
    } catch (err: any) {
      console.error("Post error:", err);
      toast.error("Failed to create post", { description: err?.message });
    } finally {
      setPosting(false);
    }
  };

  const notConnected = status !== "connected" || !profile;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col md:bg-background/80 md:backdrop-blur-sm md:items-center md:justify-center"
        >
          {/* Desktop: centered card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="flex flex-col h-full md:h-auto md:max-h-[80vh] md:w-full md:max-w-lg md:rounded-2xl md:border md:border-border md:bg-background md:shadow-modal"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
              <button
                onClick={onClose}
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
              <Button
                onClick={handlePost}
                disabled={!content.trim() || posting || notConnected}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-secondary font-semibold px-6 rounded-full min-h-[36px]"
              >
                {posting ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Posting...</>
                ) : (
                  "Post"
                )}
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {notConnected ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                  <p className="text-muted-foreground">Connect your wallet to create a post</p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                      {(profile.display_name || profile.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
                      placeholder="What's happening?"
                      className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-base min-h-[200px] leading-relaxed"
                      autoFocus
                    />

                    {mediaPreviews.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {mediaPreviews.map((src, i) => (
                          <div key={i} className="relative h-24 w-24 rounded-xl overflow-hidden">
                            <img src={src} alt="" className="h-full w-full object-cover" />
                            <button
                              onClick={() => removeMedia(i)}
                              className="absolute top-1 right-1 h-6 w-6 bg-background/80 rounded-full flex items-center justify-center active:scale-95"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom toolbar */}
            {!notConnected && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted text-primary transition-colors active:scale-95"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                  <EmojiPicker onSelect={handleEmojiSelect} />
                </div>
                <span className={`text-sm font-mono ${remaining < 20 ? "text-destructive" : "text-muted-foreground"}`}>
                  {remaining}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
