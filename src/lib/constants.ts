import {
  Home,
  Bell,
  User,
  Settings,
  MessageSquare,
  BarChart3,
  Gift,
} from "lucide-react";

export const NAV_ITEMS = [
  { title: "Home",          url: "/feed",         icon: Home },
  { title: "Market",        url: "/market",        icon: BarChart3 },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Messages",      url: "/messages",      icon: MessageSquare },
  { title: "Referral",      url: "/referral",      icon: Gift },
  { title: "Profile",       url: "/profile/me",    icon: User },
  { title: "Settings",      url: "/settings",      icon: Settings },
] as const;

export const MOBILE_NAV_ITEMS = [
  { title: "Home",    url: "/feed",         icon: Home },
  { title: "Market",  url: "/market",       icon: BarChart3 },
  // Wallet button handled separately as floating button
  { title: "Notifs",  url: "/notifications", icon: Bell },
  { title: "Referral", url: "/referral",    icon: Gift },
] as const;

export const APP_NAME = "xBAGS";
export const APP_TAGLINE = "Create. Connect. Earn.";