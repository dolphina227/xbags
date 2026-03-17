import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  LogOut,
  ExternalLink,
  Globe,
  User,
  Settings,
} from "lucide-react";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import { useProfile } from "@/hooks/use-profile";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import WalletBalance from "./WalletBalance";
import { Link } from "react-router-dom";

interface WalletDropdownProps {
  open: boolean;
  onClose: () => void;
  position?: "top" | "bottom";
}

const WalletDropdown = ({ open, onClose, position = "top" }: WalletDropdownProps) => {
  const {
    address,
    network,
    selectedWalletName,
    copyAddress,
    setNetwork,
    disconnect,
    solscanUrl,
  } = useWallet();
  const { profile } = useProfile();

  if (!address) return null;

  const positionClass =
    position === "bottom" ? "bottom-full mb-2 right-0" : "top-full mt-2 right-0";

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: position === "bottom" ? 8 : -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: position === "bottom" ? 8 : -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={`absolute ${positionClass} z-50 w-72 rounded-xl bg-card border border-border shadow-modal p-4`}
          role="menu"
          aria-label="Wallet options"
        >
          {/* Profile header */}
          <div className="flex items-center gap-3 pb-3 border-b border-border mb-3">
            <Avatar className="h-10 w-10">
              {profile?.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile.display_name || ""} />
              ) : null}
              <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                {profile?.display_name?.[0]?.toUpperCase() || address.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {profile?.display_name || truncateAddress(address, 6, 4)}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">
                  @{profile?.username || selectedWalletName} · {network === "mainnet-beta" ? "Mainnet" : "Devnet"}
                </span>
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="mb-3">
            <WalletBalance variant="default" showRefresh={true} />
          </div>

          {/* Actions */}
          <div className="space-y-0.5">
            <DropdownLink
              icon={<User className="h-4 w-4" />}
              label="Profile"
              to="/profile/me"
              onClick={onClose}
            />
            <DropdownLink
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
              to="/settings"
              onClick={onClose}
            />
            <DropdownItem
              icon={<Copy className="h-4 w-4" />}
              label="Copy Address"
              onClick={() => {
                copyAddress();
              }}
            />
            {solscanUrl && (
              <DropdownItem
                icon={<ExternalLink className="h-4 w-4" />}
                label="View on Solscan"
                onClick={() => window.open(solscanUrl, "_blank")}
              />
            )}
            <DropdownItem
              icon={<Globe className="h-4 w-4" />}
              label={`Switch to ${network === "mainnet-beta" ? "Devnet" : "Mainnet"}`}
              onClick={() => setNetwork(network === "mainnet-beta" ? "devnet" : "mainnet-beta")}
            />
          </div>

          {/* Disconnect */}
          <div className="mt-3 pt-3 border-t border-border">
            <DropdownItem
              icon={<LogOut className="h-4 w-4" />}
              label="Disconnect"
              onClick={handleDisconnect}
              destructive
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function DropdownItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted"
      }`}
      role="menuitem"
    >
      {icon}
      {label}
    </button>
  );
}

function DropdownLink({
  icon,
  label,
  to,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
      role="menuitem"
    >
      {icon}
      {label}
    </Link>
  );
}

export default WalletDropdown;
