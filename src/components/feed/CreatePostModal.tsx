import { useState, useRef } from "react";
import { X, ImagePlus, Video, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/use-profile";
import { useWallet } from "@/hooks/use-wallet";
import { feedAPI } from "@/lib/api/feed";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";
import SchedulePicker from "./SchedulePicker";
import { format } from "date-fns";

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ open, onClose }: CreatePostModalProps) {
  const { profile } = useProfile();
  const { status } = useWallet();
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<{ url: string; type: string }[]>([]);
  const [posting, setPosting] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxChars = 1000;
  const charCount = content.length;
  const remaining = maxChars - charCount;
  const isNearLimit = remaining < 100;
  const isAtLimit = remaining <= 0;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = [...mediaFiles, ...files].slice(0, 4);
    setMediaFiles(newFiles);
    setMediaPreviews(newFiles.map((f) => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith("video") ? "video" : "image",
    })));
    e.target.value = "";
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

      await feedAPI.createPost(
        profile.id, content.trim(), mediaUrls, mediaType, false, 0,
        scheduledAt ? scheduledAt.toISOString() : undefined
      );

      if (scheduledAt) {
        toast.success(`Post scheduled for ${format(scheduledAt, "MMM d, HH:mm")}! 📅`);
      } else {
        toast.success("Post created! 🎉");
      }

      setContent("");
      setMediaFiles([]);
      setMediaPreviews([]);
      setScheduledAt(null);
      onClose();
    } catch (err: any) {
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
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl md:rounded-2xl bg-background border border-border shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
              <button
                onClick={onClose}
                className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors active:scale-95"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <span className="text-sm font-semibold text-foreground">New Post</span>
              <Button
                onClick={handlePost}
                disabled={!content.trim() || posting || notConnected || isAtLimit}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-5 rounded-full h-8 text-sm"
              >
                {posting ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Posting...</> : scheduledAt ? "Schedule" : "Post"}
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {notConnected ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-muted-foreground text-sm">Connect your wallet to create a post</p>
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
                    <div className="text-sm font-semibold text-foreground mb-1">
                      {profile.display_name || profile.username}
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => {
                        const val = e.target.value.slice(0, maxChars);
                        setContent(val);
                        e.target.style.height = "auto";
                        e.target.style.height = e.target.scrollHeight + "px";
                      }}
                      placeholder="What's on your mind?"
                      className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-base min-h-[160px] leading-relaxed overflow-hidden"
                      autoFocus
                    />

                    {mediaPreviews.length > 0 && (
                      <div className={`grid gap-1.5 mt-2 ${mediaPreviews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {mediaPreviews.map(({ url, type }, i) => (
                          <div key={i} className="relative rounded-xl overflow-hidden bg-muted aspect-video">
                            {type === "video" ? (
                              <video src={url} className="h-full w-full object-cover" muted playsInline controls />
                            ) : (
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            )}
                            <button
                              onClick={() => removeMedia(i)}
                              className="absolute top-2 right-2 h-7 w-7 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors"
                            >
                              <X className="h-3.5 w-3.5 text-white" />
                            </button>
                            {type === "video" && (
                              <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 rounded-md text-[10px] text-white font-semibold tracking-wide">VIDEO</div>
                            )}
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
                  <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                  <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />

                  <button onClick={() => imageInputRef.current?.click()}
                    className="h-9 w-9 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors active:scale-95"
                    title="Add image">
                    <ImagePlus className="h-[18px] w-[18px]" />
                  </button>
                  <button onClick={() => videoInputRef.current?.click()}
                    className="h-9 w-9 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors active:scale-95"
                    title="Add video">
                    <Video className="h-[18px] w-[18px]" />
                  </button>
                  <EmojiPicker onSelect={handleEmojiSelect} />
                  <SchedulePicker scheduledAt={scheduledAt} onSchedule={setScheduledAt} />
                </div>

                {/* Character counter */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono tabular-nums ${isAtLimit ? "text-destructive font-bold" : isNearLimit ? "text-warning" : "text-muted-foreground"}`}>
                    {charCount}/{maxChars}
                  </span>
                  {/* Ring progress */}
                  <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2"
                      className="stroke-muted" />
                    <circle cx="10" cy="10" r="8" fill="none" strokeWidth="2"
                      strokeDasharray={`${Math.min((content.length / maxChars) * 50.27, 50.27)} 50.27`}
                      className={isAtLimit ? "stroke-destructive" : isNearLimit ? "stroke-warning" : "stroke-primary"}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}