"use client";

import { useSecurity } from "@/lib/store/SecurityContext";
import { LogEntry, LogEventType } from "@/types";
import { Trash2, Terminal, ChevronUp, ChevronDown, Radio, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { useState, useEffect, useRef } from "react";

// ── Badge helpers ──────────────────────────────────────────────────────────────

const EVENT_TYPE_STYLES: Record<string, string> = {
  DOM:     "text-violet-400 bg-violet-400/10 border-violet-400/20",
  Network: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  CSP:     "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Script:  "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Auth:    "text-pink-400 bg-pink-400/10 border-pink-400/20",
  RBAC:    "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  exploit: "text-red-400 bg-red-400/10 border-red-400/20",
  blocked: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  info:    "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  request: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  error:   "text-red-400 bg-red-400/10 border-red-400/20",
};

const ACTION_STYLES: Record<string, string> = {
  blocked:  "text-emerald-400",
  allowed:  "text-blue-400",
  logged:   "text-zinc-500",
  flagged:  "text-yellow-400",
  injected: "text-red-400",
  enforced: "text-violet-400",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-400",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-zinc-600",
  info:     "bg-zinc-700",
};

type FilterType = "All" | "Critical" | "DOM" | "Network" | "CSP" | "Script";
const FILTERS: FilterType[] = ["All", "Critical", "DOM", "Network", "CSP", "Script"];

function EventTypeBadge({ entry }: { entry: LogEntry }) {
  const label = entry.eventType ?? entry.type;
  const style = EVENT_TYPE_STYLES[label] ?? EVENT_TYPE_STYLES.info;
  return (
    <span className={clsx(
      "text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border shrink-0",
      style
    )}>
      {label}
    </span>
  );
}

function LogRow({ entry, isNew }: { entry: LogEntry; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const isBurst = entry.isBurst;
  const severityDot = SEVERITY_DOT[entry.severity ?? "info"] ?? SEVERITY_DOT.info;
  const actionStyle = ACTION_STYLES[entry.action ?? entry.type] ?? ACTION_STYLES.logged;

  return (
    <div
      className={clsx(
        "rounded-lg border transition-all duration-200 cursor-pointer select-none",
        isBurst
          ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/8"
          : "border-[#1a1a2e] bg-[#0a0a12] hover:border-zinc-700 hover:bg-[#0d0d18]",
        isNew && "animate-fadeInUp",
        expanded && "border-zinc-700"
      )}
      onClick={() => setExpanded((e) => !e)}
      role="button"
      aria-expanded={expanded}
    >
      {/* Main row */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 min-w-0">
        {/* Severity dot */}
        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", severityDot)} />

        {/* Timestamp */}
        <span className="text-[10px] font-mono text-zinc-600 shrink-0 tabular-nums">
          {entry.timestamp.toLocaleTimeString("en", { hour12: false })}
        </span>

        {/* Event type badge */}
        <EventTypeBadge entry={entry} />

        {/* Message */}
        <p className={clsx(
          "flex-1 min-w-0 text-xs font-mono truncate",
          isBurst ? "text-red-200" : "text-zinc-300"
        )}>
          {entry.message}
        </p>

        {/* Action tag */}
        {entry.action && (
          <span className={clsx("text-[10px] font-mono shrink-0 hidden sm:block", actionStyle)}>
            {entry.action}
          </span>
        )}

        {/* Expand indicator */}
        <span className="text-zinc-700 shrink-0">
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </span>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-zinc-800/50 mt-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2.5 text-[11px] font-mono">
            <div>
              <span className="text-zinc-600 block mb-0.5">Event Type</span>
              <span className="text-zinc-300">{entry.eventType ?? entry.type}</span>
            </div>
            {entry.source && (
              <div>
                <span className="text-zinc-600 block mb-0.5">Source</span>
                <span className="text-zinc-300 break-all">{entry.source}</span>
              </div>
            )}
            {entry.origin && (
              <div>
                <span className="text-zinc-600 block mb-0.5">Origin</span>
                <span className="text-zinc-300 break-all">{entry.origin}</span>
              </div>
            )}
            {entry.action && (
              <div>
                <span className="text-zinc-600 block mb-0.5">Action Taken</span>
                <span className={clsx("font-bold", ACTION_STYLES[entry.action] ?? "text-zinc-400")}>
                  {entry.action.toUpperCase()}
                </span>
              </div>
            )}
            {entry.severity && (
              <div>
                <span className="text-zinc-600 block mb-0.5">Severity</span>
                <span className={clsx(
                  "font-bold uppercase",
                  entry.severity === "critical" ? "text-red-400" :
                  entry.severity === "high"     ? "text-orange-400" :
                  entry.severity === "medium"   ? "text-yellow-400" : "text-zinc-500"
                )}>
                  {entry.severity}
                </span>
              </div>
            )}
            <div>
              <span className="text-zinc-600 block mb-0.5">Timestamp</span>
              <span className="text-zinc-300 tabular-nums">{entry.timestamp.toISOString()}</span>
            </div>
            {entry.detail && (
              <div className="col-span-2">
                <span className="text-zinc-600 block mb-0.5">Detail</span>
                <span className="text-zinc-400 break-all leading-relaxed">{entry.detail}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LogsPanel({ module }: { module?: string }) {
  const { logs, clearLogs, isStreaming } = useSecurity();
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<FilterType>("All");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevCountRef = useRef(0);

  // Track newly added entries for fade-in animation
  useEffect(() => {
    const currentCount = logs.length;
    if (currentCount > prevCountRef.current) {
      const added = logs.slice(0, currentCount - prevCountRef.current);
      const ids = new Set(added.map((l) => l.id));
      setNewIds(ids);
      const timer = setTimeout(() => setNewIds(new Set()), 800);
      prevCountRef.current = currentCount;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = currentCount;
  }, [logs]);

  // Filter logic
  const baseFiltered = module
    ? logs.filter((l) => l.module === module || l.module === "global")
    : logs;

  const filtered = baseFiltered.filter((l) => {
    if (filter === "All") return true;
    if (filter === "Critical") return l.severity === "critical" || l.severity === "high" || l.isBurst;
    return l.eventType === filter;
  });

  const criticalCount = baseFiltered.filter((l) => l.severity === "critical" || l.severity === "high" || l.isBurst).length;

  return (
    <div className="bg-[#0a0a12] border border-[#1a1a2e] rounded-xl overflow-hidden">

      {/* ── Header ── */}
      <div className="border-b border-[#1a1a2e]">
        <div
          className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
          onClick={() => setCollapsed((c) => !c)}
          role="button"
          aria-expanded={!collapsed}
        >
          <div className="flex items-center gap-2.5">
            <Terminal size={13} className="text-zinc-500 shrink-0" />
            <span className="text-xs font-mono text-zinc-400 font-medium">Security Log</span>
            <span className="text-zinc-600 text-[11px] font-mono">({filtered.length})</span>
            {/* Live indicator */}
            {isStreaming && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500">
                <Radio size={9} className="animate-pulse" />
                <span className="hidden sm:inline">live</span>
              </span>
            )}
            {/* Critical badge */}
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20">
                <AlertTriangle size={9} />
                {criticalCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); clearLogs(); }}
                className="text-zinc-600 hover:text-zinc-400 transition-colors p-1 touch-manipulation"
                aria-label="Clear logs"
                title="Clear logs"
              >
                <Trash2 size={12} />
              </button>
            )}
            <span className="text-zinc-700">
              {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </div>
        </div>

        {/* ── Filters ── */}
        {!collapsed && (
          <div className="flex items-center gap-1 px-4 pb-2.5 overflow-x-auto">
            {FILTERS.map((f) => {
              const count = f === "All" ? baseFiltered.length
                : f === "Critical" ? criticalCount
                : baseFiltered.filter((l) => l.eventType === f).length;
              return (
                <button
                  key={f}
                  onClick={(e) => { e.stopPropagation(); setFilter(f); }}
                  className={clsx(
                    "text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap touch-manipulation",
                    filter === f
                      ? f === "Critical"
                        ? "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-zinc-700/50 text-zinc-200 border-zinc-600"
                      : "text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  {f}
                  {count > 0 && (
                    <span className={clsx(
                      "ml-1.5 text-[10px]",
                      filter === f ? "text-zinc-400" : "text-zinc-700"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Log entries ── */}
      <div className={clsx(
        "transition-all duration-200 overflow-hidden",
        collapsed ? "max-h-0" : "max-h-[420px]"
      )}>
        <div className="h-[380px] overflow-y-auto p-3 space-y-1.5 overscroll-contain">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              {isStreaming ? (
                <>
                  <Radio size={18} className="text-emerald-500 animate-pulse" />
                  <p className="text-zinc-600 text-xs font-mono">
                    Monitoring runtime activity… waiting for events
                  </p>
                  <p className="text-zinc-700 text-[11px] font-mono">
                    {filter !== "All" ? `No ${filter} events yet` : "Stream will begin shortly"}
                  </p>
                </>
              ) : (
                <p className="text-zinc-700 text-xs font-mono">No entries match filter</p>
              )}
            </div>
          ) : (
            filtered.map((log) => (
              <LogRow key={log.id} entry={log} isNew={newIds.has(log.id)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
