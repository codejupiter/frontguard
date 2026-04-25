"use client";

import { useSecurity } from "@/lib/store/SecurityContext";
import { Zap, Shield, Radio, AlertTriangle, Activity } from "lucide-react";
import clsx from "clsx";

export default function StatusBar() {
  const { statusCounts, isStreaming, logs, mode } = useSecurity();

  const thirdPartyFlagged = logs.filter(
    (l) => l.eventType === "Script" && (l.action === "blocked" || l.action === "flagged")
  ).length;

  const stats = [
    {
      label: "Runtime Guard",
      value: "Operational",
      icon: Shield,
      color: "text-emerald-400",
      dot: "bg-emerald-400",
      pulse: true,
    },
    {
      label: "CSP Enforcement",
      value: mode === "attack" ? "Report-only" : "Active",
      icon: Activity,
      color: mode === "attack" ? "text-yellow-400" : "text-emerald-400",
      dot: mode === "attack" ? "bg-yellow-400" : "bg-emerald-400",
      pulse: false,
    },
    {
      label: "3rd-party Scripts",
      value: thirdPartyFlagged > 0 ? `${thirdPartyFlagged} flagged` : "Clean",
      icon: AlertTriangle,
      color: thirdPartyFlagged > 0 ? "text-orange-400" : "text-zinc-500",
      dot: thirdPartyFlagged > 0 ? "bg-orange-400" : "bg-zinc-700",
      pulse: thirdPartyFlagged > 0,
    },
    {
      label: "Report Pipeline",
      value: isStreaming ? "Streaming" : "Paused",
      icon: Radio,
      color: isStreaming ? "text-emerald-400" : "text-zinc-600",
      dot: isStreaming ? "bg-emerald-400" : "bg-zinc-700",
      pulse: isStreaming,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {stats.map(({ label, value, icon: Icon, color, dot, pulse }) => (
        <div
          key={label}
          className="bg-[#0a0a12] border border-[#1a1a2e] rounded-xl px-3.5 py-3 flex items-center gap-3 min-w-0"
        >
          <div className="relative shrink-0">
            <Icon size={14} className={color} />
            {pulse && (
              <span className={clsx(
                "absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-pulse",
                dot
              )} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono text-zinc-600 truncate">{label}</p>
            <p className={clsx("text-[11px] font-mono font-bold truncate", color)}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
