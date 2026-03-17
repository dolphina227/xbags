import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { useWallet } from "@/hooks/use-wallet";
import { useState } from "react";
import { toast } from "sonner";

const SettingsPage = () => {
  const { profile, setShowSetupModal } = useProfile();
  const { address, copyAddress, disconnect } = useWallet();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("bagsfun_theme", checked ? "dark" : "light");
    toast.success(checked ? "Dark mode enabled" : "Light mode enabled");
  };

  const sections = [
    {
      title: "Account",
      icon: User,
      items: [
        {
          label: "Edit Profile",
          description: "Update your display name, bio, and avatar",
          onClick: () => setShowSetupModal(true),
        },
        {
          label: "Connected Accounts",
          description: address ? `Wallet: ${address.slice(0, 6)}...${address.slice(-4)}` : "No wallet connected",
          onClick: () => {
            if (address) {
              copyAddress();
            }
          },
        },
      ],
    },
    {
      title: "Notifications",
      icon: Bell,
      disabled: true,
      items: [
        { label: "Push Notifications", description: "Receive notifications on your device", toggle: true, disabled: true },
        { label: "Email Notifications", description: "Get updates via email", toggle: true, disabled: true },
      ],
    },
    {
      title: "Privacy & Security",
      icon: Shield,
      disabled: true,
      items: [
        { label: "Private Profile", description: "Only approved followers can see your posts", toggle: true, disabled: true },
        { label: "Two-Factor Authentication", description: "Add extra security to your account", disabled: true },
      ],
    },
    {
      title: "Appearance",
      icon: Palette,
      items: [
        {
          label: "Dark Mode",
          description: darkMode ? "Currently using dark theme" : "Currently using light theme",
          toggle: true,
          checked: darkMode,
          onToggle: handleDarkModeToggle,
        },
      ],
    },
  ];

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="space-y-6">
        {sections.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.1 }}
            className={section.disabled ? "opacity-50" : ""}
          >
            <div className="flex items-center gap-2 mb-3">
              <section.icon className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm text-foreground">
                {section.title}
                {section.disabled && <span className="text-xs text-muted-foreground ml-2">(Coming Soon)</span>}
              </h2>
            </div>
            <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
              {section.items.map((item: any) => (
                <div
                  key={item.label}
                  onClick={!item.toggle && !item.disabled ? item.onClick : undefined}
                  className={`flex items-center justify-between p-4 transition-colors ${
                    item.disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                  {item.toggle && (
                    <Switch
                      checked={item.checked}
                      onCheckedChange={item.onToggle}
                      disabled={item.disabled}
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SettingsPage;
