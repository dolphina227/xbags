import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import Header from "./Header";
import BottomNav from "./BottomNav";
import RightSidebar from "./RightSidebar";

const AppLayout = () => {
  const location = useLocation();
  // Show right sidebar on feed-related pages (desktop only)
  const showRightSidebar = ["/feed", "/"].includes(location.pathname) || location.pathname.startsWith("/post/");

  // Market page needs full width for chart layout
  const isMarketPage = location.pathname === "/market";

  return (
    <div className="dark min-h-screen flex w-full bg-background text-foreground">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Header fixed di mobile agar tidak ikut scroll */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50">
          <Header />
        </div>
        <div className="flex-1 flex min-w-0">
          {/* pt-14 untuk kompensasi tinggi header fixed di mobile */}
          <main className={`flex-1 min-w-0 pb-20 md:pb-0 w-full pt-14 md:pt-0 ${isMarketPage ? "px-4" : "mx-auto max-w-[640px] px-4"}`}>
            <Outlet />
          </main>
          {showRightSidebar && <RightSidebar />}
        </div>
        <BottomNav />
      </div>
    </div>
  );
};

export default AppLayout;