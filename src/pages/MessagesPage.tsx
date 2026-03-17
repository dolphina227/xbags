import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Search, Send, ArrowLeft, Loader2, Smile, ImagePlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMessages, Conversation, Message } from "@/hooks/use-messages";
import { useProfile } from "@/hooks/use-profile";

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const EMOJI_LIST = [
  "😀","😂","🤣","😍","🥰","😎","🔥","💯","❤️","👍",
  "👏","🙌","🎉","🚀","💰","💎","🪙","📈","📉","⚡",
  "✨","🌟","💪","🤝","😏","🤔","😱","😢","🙏","👀",
  "💀","🤡","🐸","🦍","🐋","🌙","☀️","🎯","💸","🏆",
];

// Render message content: detect image URLs and render them inline
function renderMessageContent(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?)/gi;
  const parts = content.split(urlRegex);

  if (parts.length === 1) return <p>{content}</p>;

  return (
    <div className="space-y-1.5">
      {parts.map((part, idx) => {
        if (urlRegex.test(part)) {
          // Reset lastIndex since we reuse regex
          urlRegex.lastIndex = 0;
          return (
            <img
              key={idx}
              src={part}
              alt="shared image"
              className="max-w-full rounded-lg max-h-48 object-cover"
              loading="lazy"
            />
          );
        }
        urlRegex.lastIndex = 0;
        return part ? <p key={idx}>{part}</p> : null;
      })}
    </div>
  );
}

const MessagesPage = () => {
  const { profile } = useProfile();
  const {
    conversations,
    messages,
    activeConversationId,
    loading,
    loadingMessages,
    openConversation,
    sendMessage,
    closeConversation,
  } = useMessages();

  const [search, setSearch] = useState("");
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const name = c.other_user?.display_name || c.other_user?.username || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const msgContent = imagePreview
      ? `${newMsg.trim()} ${imagePreview}`.trim()
      : newMsg.trim();
    if (!msgContent || sending) return;
    setSending(true);
    try {
      await sendMessage(msgContent);
      setNewMsg("");
      setImagePreview(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // For now, create a local preview URL. In production this would upload to storage.
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    // Reset the file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addEmoji = (emoji: string) => {
    setNewMsg((prev) => prev + emoji);
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <MessageSquare className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Connect wallet to view messages</p>
      </div>
    );
  }

  // Chat view
  if (activeConversationId && activeConv) {
    const otherName = activeConv.other_user?.display_name || activeConv.other_user?.username || "User";
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeConversation}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarImage src={activeConv.other_user?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              {otherName[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-foreground">{otherName}</p>
            {activeConv.other_user?.username && (
              <p className="text-xs text-muted-foreground">@{activeConv.other_user.username}</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {loadingMessages ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Say hello! 👋</p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === profile.id;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {renderMessageContent(msg.content)}
                    <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {timeAgo(msg.created_at)}
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div className="px-4 py-2 border-t border-border">
            <div className="relative inline-block">
              <img src={imagePreview} alt="preview" className="h-20 rounded-lg object-cover" />
              <button
                onClick={() => setImagePreview(null)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input with emoji + image */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground">
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" side="top" align="start">
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => addEmoji(emoji)}
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Image attach */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-5 w-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          <Input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-muted border-0"
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <Button
            size="icon"
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground shrink-0"
            onClick={handleSend}
            disabled={(!newMsg.trim() && !imagePreview) || sending}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // Conversations list
  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          className="pl-10 bg-card border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">No conversations yet</p>
          <p className="text-xs text-muted-foreground">Start a conversation from someone's profile</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => openConversation(c.id)}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors cursor-pointer"
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={c.other_user?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                  {(c.other_user?.display_name || c.other_user?.username || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">
                    {c.other_user?.display_name || c.other_user?.username || "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{c.last_message_text || "No messages yet"}</p>
              </div>
              {c.unread_count > 0 && (
                <div className="h-5 min-w-[20px] rounded-full bg-primary flex items-center justify-center shrink-0 px-1">
                  <span className="text-[10px] font-bold text-primary-foreground">{c.unread_count}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
