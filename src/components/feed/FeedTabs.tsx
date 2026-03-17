import { motion } from "framer-motion";

type FeedTab = "home" | "recent" | "popular" | "following";

const tabs: { key: FeedTab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "recent", label: "Recent" },
  { key: "popular", label: "Popular" },
  { key: "following", label: "Following" },
];

interface FeedTabsProps {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
}

export default function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <div className="flex border-b border-border sticky top-14 md:top-0 z-10 bg-background/95 backdrop-blur-sm -mx-4 px-4">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`flex-1 py-3.5 text-sm font-medium transition-colors relative ${
            activeTab === tab.key
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {activeTab === tab.key && (
            <motion.div
              layoutId="feed-tab-indicator"
              className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full"
            />
          )}
        </button>
      ))}
    </div>
  );
}
