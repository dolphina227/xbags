import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { Wallet, Home, BarChart3, User, Gift, Coins } from "lucide-react";
import { useState } from "react";
import WalletDrawer from "@/components/wallet/WalletDrawer";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [walletOpen, setWalletOpen] = useState(false);

  // 4 menu utama: Home, Market, [Wallet], Profile
  // Leaderboard + Referral masuk ke "More"
  const leftItems = [
    { title: "Home",   url: "/feed",           icon: Home },
    { title: "Market", url: "/market",         icon: BarChart3 },
    { title: "Fees",   url: "/unclaimed-fees", icon: Coins },
  ];
  const rightItems = [
    { title: "Profile", url: "/profile/me", icon: User },
  ];

  return (
    <>
      {/* Bottom Nav — fixed, tidak ikut scroll */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[80] border-t border-border bg-background/98 backdrop-blur-xl safe-bottom">
        <div className="flex items-center justify-around h-16 px-2">

          {/* Left: Home, Market */}
          {leftItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === "/feed"}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[44px] rounded-xl transition-colors active:scale-95 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                activeClassName="text-primary"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.title}</span>
              </NavLink>
            );
          })}

          {/* Center: Floating Wallet */}
          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center justify-center h-14 w-14 -mt-6 rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform shrink-0"
            style={{ boxShadow: "0 4px 16px rgba(20, 241, 149, 0.45)" }}
          >
            <Wallet className="h-6 w-6" strokeWidth={2.5} />
          </button>

          {/* Right: Profile + More */}
          {rightItems.map((item) => {
            const isActive = location.pathname === item.url || location.pathname.startsWith("/profile/");
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[44px] rounded-xl transition-colors active:scale-95 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                activeClassName="text-primary"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.title}</span>
              </NavLink>
            );
          })}

          {/* Referral button — mengarah ke /referral */}
          <NavLink
            to="/referral"
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] min-h-[44px] rounded-xl transition-colors active:scale-95 ${
              ["/referral", "/leaderboard"].includes(location.pathname) ? "text-primary" : "text-muted-foreground"
            }`}
            activeClassName="text-primary"
          >
            <Gift className="h-5 w-5" />
            <span className="text-[10px] font-medium">Referral</span>
          </NavLink>
        </div>
      </nav>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
};

export default BottomNav;