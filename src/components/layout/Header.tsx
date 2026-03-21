import { useState } from "react";
import { Bell, Wallet, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import xbagsLogo from "@/assets/xbags-logo.png";
import WalletConnect from "@/components/wallet/WalletConnect";
import WalletDrawer from "@/components/wallet/WalletDrawer";
import { useNotifications } from "@/hooks/use-notifications";
import { useWallet } from "@/hooks/use-wallet";

const Header = () => {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const { status } = useWallet();
  const [walletDrawerOpen, setWalletDrawerOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <img
          src={xbagsLogo}
          alt="xBAGS"
          className="h-6 cursor-pointer"
          onClick={() => navigate("/")}
        />
      </div>
      <div className="flex items-center gap-1">
        {/* Messages — mobile only */}
        <button
          onClick={() => navigate("/messages")}
          className="md:hidden relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors active:scale-95"
        >
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate("/notifications")}
          className="relative h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors active:scale-95"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-destructive flex items-center justify-center">
              <span className="text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            </span>
          )}
        </button>

        {/* My Wallet button — desktop only */}
        {status === "connected" ? (
          <button
            onClick={() => setWalletDrawerOpen(true)}
            className="hidden md:flex items-center gap-2 h-9 px-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors text-sm text-foreground"
          >
            <Wallet className="h-4 w-4 text-primary" />
            My Wallet
          </button>
        ) : (
          <div className="hidden md:block">
            <WalletConnect variant="header" />
          </div>
        )}
      </div>

      <WalletDrawer open={walletDrawerOpen} onClose={() => setWalletDrawerOpen(false)} />
    </header>
  );
};

export default Header;