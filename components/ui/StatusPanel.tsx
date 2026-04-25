"use client";

import { useSecurity } from "@/lib/store/SecurityContext";
import { Shield, Globe, Code2, Activity, Cpu, AlertTriangle } from "lucide-react";
import clsx from "clsx";

interface Indicator {
  label: string;
  icon: React.ReactNode;
  getValue: (counts: { dom: number; network: number; csp: number; script: number; blocked: number }, isStreaming: boolean) => string;
  getStatus: (counts: { dom: number; network: number; csp: number; script: number; blocked: number }, isStreaming: boolean) => "ok" | "warn" | "active" | "streaming";
  getDetail: (counts: { dom: number; network: number; csp: number; script: number; blocked: number }) => string;
}

const INDICATORS: Indicator[] = [
  {
    label: "Runtime Guard",
    icon: <Shield size={13} />,
    getValue: (_, streaming) => streaming ? "Operational" : "Alert",
    getStatus: (_, streaming) => streaming ? "ok" : "warn",
    getDetail: (c) => `${c.blocked} events blocked`,
  },
  {
    label: "CSP Enforcement",
    icon: <Code2 size={13} />,
    getValue: (c) => c.csp > 0 ? "Active" : "Standby",
    getStatus: (c) => c.csp > 0 ? "active" : "ok",
    getDetail: (c) => `${c.csp} policy evaluations`,
  },
  {
    label: "3rd-Party Scripts",
    icon: <Cpu size={13} />,
    getValue: (c) => c.script > 0 ? `${c.script} flagged` : "Clean",
    getStatus: (c) => c.script > 2 ? "warn" : "ok",
    getDetail: (c) => `${c.script} script events tracked`,
  },
  {
    label: "Report Pipeline",
    icon: <Globe size={13} />,
    getValue: (_, streaming) => streaming ? "Streaming" : "Paused",
    getStatus: (_, streaming) => streaming ? "streaming" : "warn",
    getDetail: (c) => `${c.network} network events`,
  },
];

const statusStyles = {
  ok:        { dot: "bg-emerald-400",                       text: "text-emerald-400", badge: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  active:    { dot: "bg-blue-400 animate-pulse",            text: "text-blue-400",    badge: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  streaming: { dot: "bg-emerald-400 animate-pulse",         text: "text-emerald-400", badge: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  warn:      { dot: "bg-orange-400 animate-pulse",          text: "text-orange-400",  badge: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
};

export default function StatusPanel() {
  const { statusCounts, isStreaming, logs } = useSecurity();
  const hasBurst = logs.some((l) => l.isBurst);

  return (
    <div className={clsx(
      "border rounded-xl p-4 transition-colors duration-500",
      hasBurst && !isStreaming
        ? "border-orange-500/30 bg-orange-500/5"
        : "border-[#1a1a2e] bg-[#0d0d15]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <Activity size={13} />
          System Status
        </div>
        {hasBurst && !isStreaming && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-orange-400 bg-orange-400/10 px-2 py-1 rounded border border-orange-400/20">
            <AlertTriangle size={10} />
            Attack detected
          </div>
        )}
      </div>

      {/* Indicators grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {INDICATORS.map(({ label, icon, getValue, getStatus, getDetail }) => {
          const status = getStatus(statusCounts, isStreaming);
          const value = getValue(statusCounts, isStreaming);
          const detail = getDetail(statusCounts);
          const styles = statusStyles[status];

          return (
            <div
              key={label}
              className={clsx(
                "rounded-lg border px-3 py-2.5 flex flex-col gap-1.5 transition-all duration-300",
                status === "warn"
                  ? "border-orange-500/20 bg-orange-500/5"
                  : "border-zinc-800/60 bg-black/20"
              )}
            >
              <div className="flex items-center gap-1.5 text-zinc-500">
                {icon}
                <span className="text-[10px] font-mono">{label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", styles.dot)} />
                <span className={clsx("text-xs font-mono font-bold", styles.text)}>{value}</span>
              </div>
              <div className="text-[10px] font-mono text-zinc-600">{detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
