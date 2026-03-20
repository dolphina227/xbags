import { useState, useRef } from "react";
import { ImagePlus, Video, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/use-profile";
import { useWallet } from "@/hooks/use-wallet";
import { feedAPI, Post } from "@/lib/api/feed";
import { toast } from "sonner";
import EmojiPicker from "./EmojiPicker";
import SchedulePicker from "./SchedulePicker";
import { format } from "date-fns";

interface CreatePostProps {
  onPostCreated: (post: Post) => void;
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
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
  const remaining = maxChars - content.length;
  const isNearLimit = remaining < 100;
  const isAtLimit = remaining <= 0;

  if (status !== "connected" || !profile) return null;

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
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      if (newContent.length <= maxChars) {
        setContent(newContent);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          textarea.focus();
        }, 0);
      }
    } else {
      if (content.length + emoji.length <= maxChars) setContent((prev) => prev + emoji);
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

      const post = await feedAPI.createPost(
        profile.id, content.trim(), mediaUrls, mediaType, false, 0,
        scheduledAt ? scheduledAt.toISOString() : undefined
      );

      if (scheduledAt) {
        toast.success(`Post scheduled for ${format(scheduledAt, "MMM d, HH:mm")}! 📅`);
      } else {
        onPostCreated(post);
        toast.success("Post created! 🎉");
      }

      setContent("");
      setMediaFiles([]);
      setMediaPreviews([]);
      setScheduledAt(null);
    } catch (err: any) {
      toast.error("Failed to create post", { description: err?.message });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-b border-border p-4">
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
            placeholder="What's on your mind?"
            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-sm min-h-[80px] leading-relaxed"
            rows={3}
          />

          {mediaPreviews.length > 0 && (
            <div className={`grid gap-1.5 mt-2 ${mediaPreviews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {mediaPreviews.map(({ url, type }, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden bg-muted aspect-video">
                  {type === "video" ? (
                    <video src={url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button
                    onClick={() => removeMedia(i)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                  {type === "video" && (
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">VIDEO</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-0.5">
              <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />

              <button onClick={() => imageInputRef.current?.click()}
                className="h-8 w-8 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors active:scale-95"
                title="Add image">
                <ImagePlus className="h-4 w-4" />
              </button>
              <button onClick={() => videoInputRef.current?.click()}
                className="h-8 w-8 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors active:scale-95"
                title="Add video">
                <Video className="h-4 w-4" />
              </button>
              <EmojiPicker onSelect={handleEmojiSelect} />
              <SchedulePicker scheduledAt={scheduledAt} onSchedule={setScheduledAt} />

              <span className={`text-xs ml-1 font-mono tabular-nums ${isAtLimit ? "text-destructive font-bold" : isNearLimit ? "text-warning" : "text-muted-foreground"}`}>
                {remaining}
              </span>
            </div>

            <Button
              onClick={handlePost}
              disabled={!content.trim() || posting || isAtLimit}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-5 rounded-full"
            >
              {posting ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Posting...</> : scheduledAt ? "Schedule" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}