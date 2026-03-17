import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/hooks/use-wallet";
import { toast } from "sonner";

export interface Profile {
  id: string;
  wallet_address: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  is_profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  isLoading: boolean;
  needsSetup: boolean;
  showSetupModal: boolean;
  setShowSetupModal: (show: boolean) => void;
  updateProfile: (data: { username?: string; display_name?: string; bio?: string; avatar_url?: string; location?: string; website?: string }) => Promise<boolean>;
  uploadAvatar: (file: File) => Promise<string | null>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { address, status } = useWallet();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  const needsSetup = status === "connected" && !!address && (!profile || !profile.is_profile_complete);

  const fetchProfile = useCallback(async () => {
    if (!address) {
      setProfile(null);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("wallet_address", address)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);

      // Show setup modal if no profile or incomplete
      if (!data || !data.is_profile_complete) {
        setShowSetupModal(true);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (status === "connected" && address) {
      fetchProfile();
    } else {
      setProfile(null);
      setShowSetupModal(false);
    }
  }, [status, address, fetchProfile]);

  const checkUsernameAvailable = useCallback(async (username: string): Promise<boolean> => {
    if (!username || username.length < 3) return false;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (error) return false;
    // Available if no data, or if it's the current user's profile
    return !data || data.id === profile?.id;
  }, [profile?.id]);

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!address) return null;
    const ext = file.name.split(".").pop();
    const path = `${address}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
    });

    if (error) {
      toast.error("Failed to upload avatar");
      console.error(error);
      return null;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    return urlData.publicUrl;
  }, [address]);

  const updateProfile = useCallback(async (data: {
    username?: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    location?: string;
    website?: string;
  }): Promise<boolean> => {
    if (!address) return false;

    try {
      // Check username uniqueness
      if (data.username) {
        const available = await checkUsernameAvailable(data.username);
        if (!available) {
          toast.error("Username sudah dipakai", { description: "Pilih username lain." });
          return false;
        }
      }

      const profileData = {
        ...data,
        wallet_address: address,
        is_profile_complete: !!(data.username && data.display_name),
      };

      if (profile) {
        // Update existing
        const { error } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("wallet_address", address);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("profiles")
          .insert(profileData);
        if (error) throw error;
      }

      await fetchProfile();
      toast.success("Profile updated!");
      return true;
    } catch (err: any) {
      if (err?.message?.includes("idx_profiles_username_lower")) {
        toast.error("Username sudah dipakai", { description: "Pilih username lain." });
      } else {
        toast.error("Failed to save profile", { description: err?.message });
      }
      return false;
    }
  }, [address, profile, checkUsernameAvailable, fetchProfile]);

  return (
    <ProfileContext.Provider value={{
      profile,
      isLoading,
      needsSetup,
      showSetupModal,
      setShowSetupModal,
      updateProfile,
      uploadAvatar,
      checkUsernameAvailable,
      refreshProfile: fetchProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
