import { motion } from "framer-motion";
import { Heart, MessageCircle, UserPlus, Award, Bell, Check } from "lucide-react";
import { useNotifications, Notification } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, { icon: typeof Heart; color: string }> = {
  like: { icon: Heart, color: "text-destructive bg-destructive/10" },
  comment: { icon: MessageCircle, color: "text-secondary bg-secondary/10" },
  follow: { icon: UserPlus, color: "text-primary bg-primary/10" },
  token_purchase: { icon: Award, color: "text-warning bg-warning/10" },
  earnings: { icon: Award, color: "text-success bg-success/10" },
  mention: { icon: MessageCircle, color: "text-info bg-info/10" },
  info: { icon: Bell, color: "text-muted-foreground bg-muted" },
};

function getNotifStyle(type: string) {
  return iconMap[type] || iconMap.info;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const NotificationsPage = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-xs text-primary gap-1"
          >
            <Check className="h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const style = getNotifStyle(n.type);
            const Icon = style.icon;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => !n.read && markAsRead(n.id)}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
                  n.read
                    ? "bg-card border-border"
                    : "bg-primary/5 border-primary/20"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${style.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-muted-foreground truncate">
                      {n.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
                {!n.read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
