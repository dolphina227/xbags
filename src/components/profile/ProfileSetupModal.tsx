import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Check, X, Loader2, MapPin, Link as LinkIcon } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

const ProfileSetupModal = () => {
  const { profile, showSetupModal, setShowSetupModal, updateProfile, uploadAvatar, checkUsernameAvailable } = useProfile();
  const { address } = useWallet();

  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [website, setWebsite] = useState(profile?.website || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  // Debounced username check
  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle");
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      setUsernameStatus(available ? "available" : "taken");
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, checkUsernameAvailable]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    const url = await uploadAvatar(file);
    if (url) setAvatarUrl(url);
    setIsUploading(false);
  };

  const handleSave = async () => {
    if (!username || !displayName) return;
    if (usernameStatus === "taken" || usernameStatus === "invalid") return;

    setIsSaving(true);
    const success = await updateProfile({
      username,
      display_name: displayName,
      bio: bio || undefined,
      avatar_url: avatarUrl || undefined,
      location: location || undefined,
      website: website || undefined,
    });

    if (success) {
      // ── Proses referral ──
      // PENTING: updateProfile memanggil fetchProfile() di dalamnya,
      // tapi React state belum update saat baris ini dijalankan.
      // Jadi kita fetch langsung dari database pakai wallet address.
      try {
        const refCode = localStorage.getItem("xbags_ref")
          || new URLSearchParams(window.location.search).get("ref");

        if (refCode && address) {
          // Fetch profile ID langsung dari DB (bukan dari state yang mungkin belum update)
          const { data: freshProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("wallet_address", address)
            .single();

          const userId = freshProfile?.id;
          if (!userId) throw new Error("Profile ID not found");

          // Cek sudah pernah pakai referral
          const { data: alreadyUsed } = await supabase
            .from("referral_uses" as any)
            .select("id")
            .eq("used_by_user_id", userId)
            .maybeSingle();

          if (!alreadyUsed) {
            // Cari referral code
            const { data: referral } = await supabase
              .from("referrals" as any)
              .select("id, user_id, total_referrals, total_points")
              .eq("code", refCode.trim().toUpperCase())
              .maybeSingle();

            // Juga coba tanpa uppercase jika tidak ketemu
            const { data: referral2 } = !referral ? await supabase
              .from("referrals" as any)
              .select("id, user_id, total_referrals, total_points")
              .eq("code", refCode.trim())
              .maybeSingle() : { data: null };

            const ref = (referral || referral2) as any;

            if (ref && ref.user_id !== userId) {
              // Update poin pemilik referral
              const { error: updateErr } = await supabase
                .from("referrals" as any)
                .update({
                  total_referrals: (ref.total_referrals || 0) + 1,
                  total_points: (ref.total_points || 0) + 5000,
                })
                .eq("id", ref.id);

              if (!updateErr) {
                // Catat pemakaian
                await supabase
                  .from("referral_uses" as any)
                  .insert({
                    referral_id: ref.id,
                    used_by_user_id: userId,
                    points_granted: 5000,
                  });

                // Beri 5000 poin ke user yang baru daftar juga
                await supabase
                  .from("referrals" as any)
                  .upsert({
                    user_id: userId,
                    code: `REF${userId.slice(0, 6).toUpperCase()}`,
                    total_referrals: 0,
                    total_points: 5000,
                  }, { onConflict: "user_id" });

                toast.success("🎉 You got 5,000 xBAGS Points for joining via referral!");
              }
            }
          }

          // Bersihkan
          localStorage.removeItem("xbags_ref");
          const url = new URL(window.location.href);
          url.searchParams.delete("ref");
          window.history.replaceState({}, "", url.toString());
        }
      } catch (err) {
        console.error("[referral] error:", err);
        // Silent — jangan blokir setup
      }

      setIsSaving(false);
      setShowSetupModal(false);
    } else {
      setIsSaving(false);
    }
  };

  const canSave = username && displayName && USERNAME_REGEX.test(username) && usernameStatus !== "taken" && usernameStatus !== "checking";

  return (
    <Dialog open={showSetupModal} onOpenChange={setShowSetupModal}>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-foreground">Set Up Your Profile</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connected as {address ? truncateAddress(address) : ""}. Set your name and username to get started.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] px-6 pb-6">
          <div className="space-y-5 pt-2">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="h-20 w-20 border-2 border-border">
                  {(avatarPreview || avatarUrl) ? (
                    <AvatarImage src={avatarPreview || avatarUrl} alt="Avatar" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {displayName?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Camera className="h-5 w-5 text-primary" />}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <p className="text-xs text-muted-foreground">Click to upload photo</p>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-foreground">Display Name *</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                className="bg-background border-border"
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">Username *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="username"
                  maxLength={20}
                  className="pl-7 bg-background border-border"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {usernameStatus === "available" && <Check className="h-4 w-4 text-green-500" />}
                  {usernameStatus === "taken" && <X className="h-4 w-4 text-destructive" />}
                  {usernameStatus === "invalid" && <X className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              {usernameStatus === "taken" && <p className="text-xs text-destructive">Username sudah dipakai</p>}
              {usernameStatus === "invalid" && <p className="text-xs text-destructive">3-20 karakter, hanya huruf, angka, underscore</p>}
              {usernameStatus === "available" && <p className="text-xs text-green-500">Username tersedia!</p>}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-foreground">Bio <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself..."
                maxLength={160}
                rows={3}
                className="bg-background border-border resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Location <span className="text-muted-foreground">(optional)</span></span>
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Global"
                maxLength={50}
                className="bg-background border-border"
              />
            </div>

            {/* Website */}
            <div className="space-y-2">
              <Label htmlFor="website" className="text-foreground">
                <span className="flex items-center gap-1.5"><LinkIcon className="h-3.5 w-3.5" /> Website <span className="text-muted-foreground">(optional)</span></span>
              </Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g. xbags.com"
                maxLength={100}
                className="bg-background border-border"
              />
            </div>

            {/* Save */}
            <Button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className="w-full"
            >
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Profile"}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSetupModal;