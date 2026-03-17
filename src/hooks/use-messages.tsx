import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_text: string | null;
  last_message_at: string | null;
  other_user: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    wallet_address: string;
  } | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export function useMessages() {
  const { profile } = useProfile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Get conversations where user is a participant
      const { data: participations, error: pErr } = await supabase
        .from("message_participants")
        .select("conversation_id, unread_count")
        .eq("profile_id", profile.id);

      if (pErr) throw pErr;
      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const convIds = participations.map((p: any) => p.conversation_id);
      const unreadMap = Object.fromEntries(
        participations.map((p: any) => [p.conversation_id, p.unread_count])
      );

      // Fetch conversation details
      const { data: convs, error: cErr } = await supabase
        .from("conversations")
        .select("*")
        .in("id", convIds)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (cErr) throw cErr;

      // Get other participants
      const { data: allParts } = await supabase
        .from("message_participants")
        .select("conversation_id, profile_id")
        .in("conversation_id", convIds)
        .neq("profile_id", profile.id);

      const otherProfileIds = [...new Set((allParts || []).map((p: any) => p.profile_id))];
      
      let profilesMap: Record<string, any> = {};
      if (otherProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, wallet_address")
          .in("id", otherProfileIds);
        profilesMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      }

      const otherByConv = Object.fromEntries(
        (allParts || []).map((p: any) => [p.conversation_id, profilesMap[p.profile_id] || null])
      );

      const result: Conversation[] = (convs || []).map((c: any) => ({
        ...c,
        other_user: otherByConv[c.id] || null,
        unread_count: unreadMap[c.id] || 0,
      }));

      setConversations(result);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set((data || []).map((m: any) => m.sender_id))];
      let sendersMap: Record<string, any> = {};
      if (senderIds.length > 0) {
        const { data: senders } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", senderIds);
        sendersMap = Object.fromEntries((senders || []).map((s: any) => [s.id, s]));
      }

      setMessages(
        (data || []).map((m: any) => ({
          ...m,
          sender: sendersMap[m.sender_id] || null,
        }))
      );

      // Mark as read
      if (profile?.id) {
        await supabase.rpc("mark_messages_read" as any, {
          p_conversation_id: conversationId,
          p_profile_id: profile.id,
        });
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, [profile?.id]);

  const openConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    fetchMessages(conversationId);
  }, [fetchMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!profile?.id || !activeConversationId || !content.trim()) return;

    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: activeConversationId, sender_id: profile.id, content: content.trim() } as any)
      .select()
      .single();

    if (error) throw error;

    // Update conversation last message
    await supabase
      .from("conversations")
      .update({ last_message_text: content.trim(), last_message_at: new Date().toISOString() } as any)
      .eq("id", activeConversationId);

    // Increment unread for other participants
    const { data: parts } = await supabase
      .from("message_participants")
      .select("id, profile_id, unread_count")
      .eq("conversation_id", activeConversationId)
      .neq("profile_id", profile.id);

    for (const p of parts || []) {
      await supabase
        .from("message_participants")
        .update({ unread_count: (p as any).unread_count + 1 } as any)
        .eq("id", (p as any).id);
    }

    return data;
  }, [profile?.id, activeConversationId]);

  const startConversation = useCallback(async (otherProfileId: string): Promise<string | null> => {
    if (!profile?.id) return null;

    // Check if conversation already exists
    const { data: myParts } = await supabase
      .from("message_participants")
      .select("conversation_id")
      .eq("profile_id", profile.id);

    if (myParts && myParts.length > 0) {
      const myConvIds = myParts.map((p: any) => p.conversation_id);
      const { data: otherParts } = await supabase
        .from("message_participants")
        .select("conversation_id")
        .eq("profile_id", otherProfileId)
        .in("conversation_id", myConvIds);

      if (otherParts && otherParts.length > 0) {
        const existingId = (otherParts[0] as any).conversation_id;
        openConversation(existingId);
        return existingId;
      }
    }

    // Create new conversation
    const { data: conv, error: cErr } = await supabase
      .from("conversations")
      .insert({} as any)
      .select()
      .single();

    if (cErr) throw cErr;

    const convId = (conv as any).id;
    await supabase.from("message_participants").insert([
      { conversation_id: convId, profile_id: profile.id } as any,
      { conversation_id: convId, profile_id: otherProfileId } as any,
    ]);

    openConversation(convId);
    return convId;
  }, [profile?.id, openConversation]);

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`messages-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // If it's in the active conversation, add to messages
          if (newMsg.conversation_id === activeConversationId) {
            const exists = messages.some((m) => m.id === newMsg.id);
            if (!exists) {
              // Fetch sender info
              const { data: sender } = await supabase
                .from("profiles")
                .select("id, display_name, username, avatar_url")
                .eq("id", newMsg.sender_id)
                .single();

              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, { ...newMsg, sender: sender || null }];
              });

              // Mark as read since conversation is open
              if (newMsg.sender_id !== profile.id) {
                await supabase.rpc("mark_messages_read" as any, {
                  p_conversation_id: activeConversationId,
                  p_profile_id: profile.id,
                });
              }
            }
          }

          // Refresh conversation list
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, activeConversationId, messages, fetchConversations]);

  return {
    conversations,
    messages,
    activeConversationId,
    loading,
    loadingMessages,
    openConversation,
    sendMessage,
    startConversation,
    closeConversation: () => { setActiveConversationId(null); setMessages([]); },
    refetch: fetchConversations,
  };
}
