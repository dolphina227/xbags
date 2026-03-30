import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { NAV_ITEMS } from "@/lib/constants";
import xbagsLogo from "@/assets/xbags-logo.png";
import { useWallet, truncateAddress } from "@/hooks/use-wallet";
import { useProfile } from "@/hooks/use-profile";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, Plus, ArrowUpRight, LogOut, Wallet } from "lucide-react";
import WalletConnect from "@/components/wallet/WalletConnect";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import WithdrawModal from "@/components/wallet/WithdrawModal";
import WalletDrawer from "@/components/wallet/WalletDrawer";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import CreatePostModal from "@/components/feed/CreatePostModal";

const AppSidebar = () => {
  const location = useLocation();
  const { status, address, balance, balanceUsd, selectedWalletName, disconnect } = useWallet();
  const { profile } = useProfile();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [walletDrawerOpen, setWalletDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  return (
    <aside className="hidden md:flex flex-col w-[200px] lg:w-[220px] border-r border-border bg-background h-screen sticky top-0 shrink-0 overflow-hidden">
      {/* Logo - Sejajar dengan icon menu */}
      <div className="flex items-center gap-3 px-3 py-3 shrink-0">
        <img 
          src={xbagsLogo} 
          alt="xBAGS" 
          className="h-8 lg:h-10 w-auto object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/feed"}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium tracking-tight transition-all ${
                isActive ? "" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
              activeClassName="bg-primary/10 text-primary font-semibold"
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="leading-none">{item.title}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="shrink-0 space-y-3 pb-4">
        {/* CTA Button */}
        <div className="px-3">
          <button
            onClick={() => setCreatePostOpen(true)}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm tracking-tight hover:bg-primary/90 transition-all hover:shadow-glow active:scale-95"
          >
            Create Post
          </button>
        </div>
        <CreatePostModal open={createPostOpen} onClose={() => setCreatePostOpen(false)} />

        {/* User / Wallet Section */}
        <div className="px-3 relative" ref={menuRef}>
          {status === "connected" && address ? (
            <>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={profile.display_name || ""} />
                  ) : null}
                  <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                    {profile?.display_name?.[0]?.toUpperCase() || address.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {profile?.display_name || truncateAddress(address)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{profile?.username || truncateAddress(address)}
                  </div>
                </div>
                <ChevronUp className={`h-3 w-3 text-muted-foreground transition-transform ${userMenuOpen ? "" : "rotate-180"}`} />
              </button>

              {/* Dropdown menu */}
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-3 right-3 mb-2 z-50 rounded-xl bg-card border border-border shadow-modal p-2"
                  >
                    <MenuItem icon={<Wallet className="h-4 w-4" />} label="My Wallet" onClick={() => { setWalletDrawerOpen(true); setUserMenuOpen(false); }} />
                    <div className="border-t border-border my-1" />
                    <MenuItem icon={<Plus className="h-4 w-4" />} label="Add Funds" onClick={() => { setAddFundsOpen(true); setUserMenuOpen(false); }} />
                    <MenuItem icon={<ArrowUpRight className="h-4 w-4" />} label="Withdraw" onClick={() => { setWithdrawOpen(true); setUserMenuOpen(false); }} />
                    <div className="border-t border-border my-1" />
                    <MenuItem
                      icon={<LogOut className="h-4 w-4" />}
                      label="Log out"
                      onClick={() => { disconnect(); setUserMenuOpen(false); }}
                      destructive
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <AddFundsModal open={addFundsOpen} onClose={() => setAddFundsOpen(false)} />
              <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
              <WalletDrawer open={walletDrawerOpen} onClose={() => setWalletDrawerOpen(false)} />
            </>
          ) : (
            <WalletConnect variant="default" />
          )}
        </div>
      </div>
    </aside>
  );
};

function MenuItem({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick?: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default AppSidebar;