import { NavLink } from "@/components/NavLink";
import { MOBILE_NAV_ITEMS } from "@/lib/constants";
import { useLocation } from "react-router-dom";
import { Wallet } from "lucide-react";
import { useState } from "react";
import WalletDrawer from "@/components/wallet/WalletDrawer";

const BottomNav = () => {
  const location = useLocation();
  const [walletOpen, setWalletOpen] = useState(false);

  const leftItems = MOBILE_NAV_ITEMS.slice(0, 2);
  const rightItems = MOBILE_NAV_ITEMS.slice(2, 4);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl safe-bottom">
        <div className="flex items-center justify-around h-16">
          {leftItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === "/feed"}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-xl transition-colors active:scale-95 ${
                  isActive ? "" : "text-muted-foreground"
                }`}
                activeClassName="text-primary"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.title}</span>
              </NavLink>
            );
          })}

          {/* Floating Wallet Button */}
          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center justify-center h-14 w-14 -mt-6 rounded-full bg-primary text-primary-foreground active:scale-90 transition-transform"
            style={{ boxShadow: "0 4px 12px rgba(20, 241, 149, 0.4)" }}
          >
            <Wallet className="h-6 w-6" strokeWidth={2.5} />
          </button>

          {rightItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.url === "/feed"}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] rounded-xl transition-colors active:scale-95 ${
                  isActive ? "" : "text-muted-foreground"
                }`}
                activeClassName="text-primary"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.title}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <WalletDrawer open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
};

export default BottomNav;
