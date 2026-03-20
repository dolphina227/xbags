import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any> | null;
  read: boolean;
  created_at: string;
}

// Normalize type dari database ke type yang kita pakai
function normalizeType(type: string): string {
  const t = (type || "").toLowerCase();
  if (t.includes("like")) return "like";
  if (t.includes("comment") || t.includes("reply")) return "comment";
  if (t.includes("follow")) return "follow";
  if (t.includes("mention")) return "mention";
  if (t.includes("repost")) return "repost";
  return t;
}

// Extract nama pengirim dari message notifikasi lama
// "K E N T H liked your post" → "KENTH"
// "beryll followed you" → "beryll"
// "New Like" (title) + "KENTH liked your post" (message) → "KENTH"
function extractSenderName(n: Notification): string | null {
  // Prioritas 1: dari data field
  if (n.data?.sender_username) return n.data.sender_username;

  // Prioritas 2: parse dari message
  const msg = (n.message || "").trim();
  if (!msg) return null;

  const actionWords = ["liked", "followed", "commented", "reposted", "mentioned", "replied", "on"];
  const words = msg.split(" ");
  const actionIdx = words.findIndex(w => actionWords.includes(w.toLowerCase()));

  if (actionIdx > 0) {
    // Gabungkan semua kata sebelum verb (handle spasi antar huruf "K E N T H" → "KENTH")
    return words.slice(0, actionIdx).join("").trim() || null;
  }

  return words[0] || null;
}

export function useNotifications() {
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Gunakan ref agar enrichNotifications tidak recreate terus
  const enrichNotifications = useCallback(async (items: Notification[]): Promise<Notification[]> => {
    if (items.length === 0) return items;

    // Kumpulkan semua nama yang perlu dicari — yang belum punya avatar
    const toEnrich = items.filter(n => !n.data?.sender_avatar_url);
    if (toEnrich.length === 0) return items;

    const names = new Set<string>();
    toEnrich.forEach(n => {
      const name = extractSenderName(n);
      if (name && name.length >= 2) names.add(name);
    });

    if (names.size === 0) return items;

    const nameList = [...names];

    // Fetch by username DAN display_name sekaligus
    const [{ data: byUsername }, { data: byDisplayName }] = await Promise.all([
      supabase.from("profiles")
        .select("username, display_name, avatar_url")
        .in("username", nameList),
      supabase.from("profiles")
        .select("username, display_name, avatar_url")
        .in("display_name", nameList),
    ]);

    // Build lookup map — case insensitive
    const map = new Map<string, any>();
    [...(byUsername || []), ...(byDisplayName || [])].forEach((p: any) => {
      if (p.username) map.set(p.username.toLowerCase(), p);
      if (p.display_name) map.set(p.display_name.toLowerCase(), p);
    });

    if (map.size === 0) return items;

    return items.map(n => {
      if (n.data?.sender_avatar_url) return n;

      const name = extractSenderName(n);
      if (!name) return n;

      const p = map.get(name.toLowerCase());
      if (!p) return n;

      return {
        ...n,
        type: normalizeType(n.type),
        data: {
          ...(n.data || {}),
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

      // Normalize semua type dulu
      const raw = (data || []).map((n: any) => ({
        ...n,
        type: normalizeType(n.type),
        data: n.data || {},
      })) as Notification[];

      const enriched = await enrichNotifications(raw);
      setNotifications(enriched);
      setUnreadCount(enriched.filter(n => !n.read).length);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, enrichNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        async (payload) => {
          const raw = payload.new as any;
          if (raw.user_id !== profile.id) return;

          const normalized = {
            ...raw,
            type: normalizeType(raw.type),
            data: raw.data || {},
          } as Notification;

          const [enriched] = await enrichNotifications([normalized]);
          setNotifications(prev => [enriched, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, enrichNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("notifications")
      .update({ read: true } as any)
      .eq("id", notificationId);
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!profile?.id) return;
    await supabase
      .from("notifications")
      .update({ read: true } as any)
      .eq("user_id", profile.id)
      .eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [profile?.id]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}