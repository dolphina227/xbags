import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, MessageCircle, UserPlus, Award, Bell, Check, AtSign } from "lucide-react";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

type FilterTab = "all" | "like" | "comment" | "mention" | "follow";

const TABS: { key: FilterTab; label: string; icon: any }[] = [
  { key: "all",     label: "All",      icon: Bell },
  { key: "like",    label: "Likes",    icon: Heart },
  { key: "comment", label: "Replies",  icon: MessageCircle },
  { key: "mention", label: "Mentions", icon: AtSign },
  { key: "follow",  label: "Follows",  icon: UserPlus },
];

const iconMap: Record<string, { icon: any; color: string }> = {
  like:           { icon: Heart,         color: "text-destructive bg-destructive/10" },
  comment:        { icon: MessageCircle, color: "text-secondary bg-secondary/10" },
  follow:         { icon: UserPlus,      color: "text-primary bg-primary/10" },
  mention:        { icon: AtSign,        color: "text-info bg-info/10" },
  token_purchase: { icon: Award,         color: "text-warning bg-warning/10" },
  earnings:       { icon: Award,         color: "text-success bg-success/10" },
  info:           { icon: Bell,          color: "text-muted-foreground bg-muted" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filtered = activeTab === "all"
    ? notifications
    : notifications.filter((n) => n.type === activeTab);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs text-primary gap-1">
            <Check className="h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.key === "all"
            ? notifications.filter(n => !n.read).length
            : notifications.filter(n => n.type === tab.key && !n.read).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors shrink-0 ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-primary/20 text-primary"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading && notifications.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3,4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground font-semibold mb-1">
            No {activeTab !== "all" ? TABS.find(t => t.key === activeTab)?.label.toLowerCase() + " " : ""}notifications
          </p>
          <p className="text-sm text-muted-foreground">
            You don't have any {activeTab !== "all" ? TABS.find(t => t.key === activeTab)?.label.toLowerCase() + " " : ""}notifications.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n, i) => {
            const style = iconMap[n.type] || iconMap.info;
            const Icon = style.icon;
            const senderUsername = n.data?.sender_username;
            const senderAvatar = n.data?.sender_avatar_url;

            const goToProfile = (e?: React.MouseEvent) => {
              e?.stopPropagation();
              if (!n.read) markAsRead(n.id);
              if (senderUsername) navigate(`/profile/${senderUsername}`);
            };

            const goToPost = () => {
              if (!n.read) markAsRead(n.id);
              if (n.data?.post_id) navigate(`/post/${n.data.post_id}`);
              else if (senderUsername) navigate(`/profile/${senderUsername}`);
            };

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={goToPost}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
                  n.read ? "bg-card border-border" : "bg-primary/5 border-primary/20"
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0" onClick={goToProfile}>
                  {senderAvatar ? (
                    <img src={senderAvatar} alt="" className="h-10 w-10 rounded-full object-cover hover:opacity-80 transition-opacity" />
                  ) : senderUsername ? (
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary hover:bg-primary/30 transition-colors">
                      {senderUsername[0]?.toUpperCase()}
                    </div>
                  ) : (
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${style.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  )}
                  {senderUsername && (
                    <div className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center border-2 border-background ${style.color}`}>
                      <Icon className="h-2.5 w-2.5" />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">
                    {senderUsername ? (
                      <>
                        <span
                          className="font-semibold hover:underline cursor-pointer"
                          onClick={goToProfile}
                        >
                          {senderUsername}
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">@{senderUsername}</span>
                        {" "}
                        <span className="text-muted-foreground text-xs">
                          {n.type === "like" && "liked your post"}
                          {n.type === "comment" && "replied to your post"}
                          {n.type === "follow" && "followed you"}
                          {n.type === "mention" && "mentioned you"}
                          {n.type === "repost" && "reposted your post"}
                          {!["like","comment","follow","mention","repost"].includes(n.type) && n.title.replace(/^new\s+/i, "")}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium">{n.title}</span>
                    )}
                  </p>
                  {n.message && n.type === "mention" && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{n.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                </div>

                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;