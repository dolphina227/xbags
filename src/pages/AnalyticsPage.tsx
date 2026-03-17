import { motion } from "framer-motion";
import { BarChart3, Eye, Heart, Users, TrendingUp } from "lucide-react";

const stats = [
  { label: "Total Views", value: "24.5K", change: "+12%", icon: Eye, color: "text-primary bg-primary/10" },
  { label: "Total Likes", value: "3,892", change: "+8%", icon: Heart, color: "text-destructive bg-destructive/10" },
  { label: "Followers", value: "1,247", change: "+23%", icon: Users, color: "text-secondary bg-secondary/10" },
  { label: "Engagement", value: "4.8%", change: "+2%", icon: TrendingUp, color: "text-success bg-success/10" },
];

const weeklyData = [
  { day: "Mon", views: 340 },
  { day: "Tue", views: 520 },
  { day: "Wed", views: 410 },
  { day: "Thu", views: 680 },
  { day: "Fri", views: 590 },
  { day: "Sat", views: 820 },
  { day: "Sun", views: 750 },
];

const maxViews = Math.max(...weeklyData.map((d) => d.views));

const AnalyticsPage = () => {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl bg-card border border-border shadow-card"
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="text-2xl font-bold text-foreground">{s.value}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-xs font-medium text-success">{s.change}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Simple bar chart */}
      <div className="p-6 rounded-xl bg-card border border-border shadow-card">
        <h2 className="font-semibold mb-6">Weekly Views</h2>
        <div className="flex items-end gap-3 h-48">
          {weeklyData.map((d, i) => (
            <motion.div
              key={d.day}
              className="flex-1 flex flex-col items-center gap-2"
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              style={{ transformOrigin: "bottom" }}
            >
              <div
                className="w-full bg-primary/80 rounded-t-md hover:bg-primary transition-colors"
                style={{ height: `${(d.views / maxViews) * 100}%` }}
              />
              <span className="text-xs text-muted-foreground">{d.day}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
