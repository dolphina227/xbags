import {
  Home,
  Compass,
  Bell,
  User,
  Settings,
  MessageSquare,
  BarChart3,
} from "lucide-react";

export const NAV_ITEMS = [
  { title: "Home", url: "/feed", icon: Home },
  { title: "Market", url: "/market", icon: BarChart3 },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Profile", url: "/profile/me", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export const MOBILE_NAV_ITEMS = [
  { title: "Home", url: "/feed", icon: Home },
  { title: "Market", url: "/market", icon: BarChart3 },
  // Wallet button is handled separately as floating button
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Messages", url: "/messages", icon: MessageSquare },
] as const;

export const APP_NAME = "xbags";
export const APP_TAGLINE = "Create. Connect. Earn.";
