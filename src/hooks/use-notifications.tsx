import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
}

// "K E N T H liked your post" → "KENTH"
// "beryll followed you" → "beryll"
function extractNameFromMessage(msg: string): string | null {
  if (!msg) return null;
  const actionWords = ["liked", "followed", "commented", "reposted", "mentioned", "replied"];
  const words = msg.split(" ");
  const actionIdx = words.findIndex(w => actionWords.includes(w.toLowerCase()));
  if (actionIdx > 0) return words.slice(0, actionIdx).join("") || null;
  return words[0] || null;
}

export function useNotifications() {
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const enrichNotifications = useCallback(async (items: Notification[]): Promise<Notification[]> => {
    const needEnrich = items.filter(n => !n.data?.sender_avatar_url);
    if (needEnrich.length === 0) return items;

    // Kumpulkan semua nama yang perlu dicari
    const names = new Set<string>();
    needEnrich.forEach((n) => {
      if (n.data?.sender_username) {
        names.add(n.data.sender_username);
      } else if (n.message) {
        const name = extractNameFromMessage(n.message);
        if (name) names.add(name);
      }
    });

    if (names.size === 0) return items;

    const nameList = [...names];

    // Query by username DAN display_name sekaligus
    const [{ data: byUsername }, { data: byDisplayName }] = await Promise.all([
      supabase.from("profiles").select("username, display_name, avatar_url").in("username", nameList),
      supabase.from("profiles").select("username, display_name, avatar_url").in("display_name", nameList),
    ]);

    // Buat lookup map
    const map = new Map<string, any>();
    [...(byUsername || []), ...(byDisplayName || [])].forEach((p: any) => {
      if (p.username) map.set(p.username.toLowerCase(), p);
      if (p.display_name) map.set(p.display_name.toLowerCase(), p);
    });

    if (map.size === 0) return items;

    return items.map((n) => {
      if (n.data?.sender_avatar_url) return n;

      let p: any = null;
      if (n.data?.sender_username) {
        p = map.get(n.data.sender_username.toLowerCase());
      }
      if (!p && n.message) {
        const name = extractNameFromMessage(n.message);
        if (name) p = map.get(name.toLowerCase());
      }
      if (!p) return n;

      return {
        ...n,
        data: {
          ...n.data,
          sender_username: p.username,
          sender_avatar_url: p.avatar_url,
        },
      };
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      const raw = (data || []) as unknown as Notification[];
      const enriched = await enrichNotifications(raw);
      setNotifications(enriched);
      setUnreadCount(enriched.filter((n) => !n.read).length);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, enrichNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const newNotif = payload.new as unknown as Notification;
          if (newNotif.user_id !== profile.id) return;
          enrichNotifications([newNotif]).then(([enriched]) => {
            setNotifications((prev) => [enriched, ...prev]);
            setUnreadCount((prev) => prev + 1);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, enrichNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase.from("notifications").update({ read: true } as any).eq("id", notificationId);
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!profile?.id) return;
    await supabase.from("notifications").update({ read: true } as any).eq("user_id", profile.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [profile?.id]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}