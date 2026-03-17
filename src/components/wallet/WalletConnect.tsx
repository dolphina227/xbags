import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import { useProfile } from "@/hooks/use-profile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import WalletModal from "./WalletModal";
import WalletDropdown from "./WalletDropdown";

interface WalletConnectProps {
  variant?: "default" | "header" | "mobile-icon";
}

const WalletConnect = ({ variant = "default" }: WalletConnectProps) => {
  const { status, address } = useWallet();
  const { profile } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dropdownOpen]);

  // Not connected
  if (status !== "connected" || !address) {
    if (variant === "mobile-icon") {
      return (
        <>
          <button
            onClick={() => setModalOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-muted-foreground transition-colors hover:text-primary"
            aria-label="Connect wallet"
          >
            <Wallet className="h-5 w-5" />
            <span className="text-[10px] font-medium">Wallet</span>
          </button>
          <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      );
    }

    if (variant === "header") {
      return (
        <>
          <Button
            onClick={() => setModalOpen(true)}
            size="sm"
            className="gap-2 bg-primary text-primary-foreground hover:bg-secondary transition-colors"
            aria-label="Connect wallet"
          >
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-semibold">Connect</span>
          </Button>
          <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
        </>
      );
    }

    return (
      <>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={() => setModalOpen(true)}
            size="lg"
            className="gap-2 bg-primary text-primary-foreground hover:bg-secondary glow-primary animate-pulse-glow"
            aria-label="Connect wallet"
          >
            <Wallet className="h-5 w-5" />
            Connect Wallet
          </Button>
        </motion.div>
        <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // Connected
  const displayName = profile?.display_name || truncateAddress(address);

  if (variant === "mobile-icon") {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-primary transition-colors"
          aria-label="Wallet menu"
        >
          <div className="relative">
            <Avatar className="h-5 w-5">
              {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
              <AvatarFallback className="bg-primary/20 text-primary text-[8px] font-bold">
                {profile?.display_name?.[0]?.toUpperCase() || address.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success border border-background" />
          </div>
          <span className="text-[10px] font-medium">Wallet</span>
        </button>
        <WalletDropdown open={dropdownOpen} onClose={() => setDropdownOpen(false)} position="bottom" />
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-primary/30 transition-all bg-card ${
          variant === "header" ? "h-9" : ""
        }`}
        aria-label="Wallet menu"
        aria-expanded={dropdownOpen}
      >
        <div className="relative">
          <Avatar className="h-6 w-6">
            {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
              {profile?.display_name?.[0]?.toUpperCase() || address.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
        </div>
        <span className="text-sm font-medium text-foreground">
          {displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </motion.button>
      <WalletDropdown open={dropdownOpen} onClose={() => setDropdownOpen(false)} position="top" />
    </div>
  );
};

export default WalletConnect;
