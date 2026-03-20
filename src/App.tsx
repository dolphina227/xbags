import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SolanaWalletProvider from "@/components/wallet/SolanaWalletProvider";
import { BagsFunWalletProvider } from "@/hooks/use-wallet";
import { ProfileProvider } from "@/hooks/use-profile";
import ProfileSetupModal from "@/components/profile/ProfileSetupModal";
import AppLayout from "@/components/layout/AppLayout";
import LandingPage from "./pages/LandingPage";
import FeedPage from "./pages/FeedPage";
import MarketPage from "./pages/MarketPage";
import NotificationsPage from "./pages/NotificationsPage";
import MessagesPage from "./pages/MessagesPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import PostDetailPage from "./pages/PostDetailPage";
import NotFound from "./pages/NotFound";
import ReferralPage from "./pages/ReferralPage";
import LeaderboardPage from "./pages/LeaderboardPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SolanaWalletProvider>
        <BagsFunWalletProvider>
          <ProfileProvider>
          <Toaster />
          <Sonner />
          <ProfileSetupModal />
          <BrowserRouter>
            <Routes>
              {/* Landing page — no AppLayout */}
              <Route path="/" element={<LandingPage />} />

              {/* App routes with layout */}
              <Route element={<AppLayout />}>
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/market" element={<MarketPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/referral" element={<ReferralPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/post/:postId" element={<PostDetailPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </ProfileProvider>
        </BagsFunWalletProvider>
      </SolanaWalletProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;