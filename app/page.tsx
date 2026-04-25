"use client";

import Link from "next/link";
import { useSecurity } from "@/lib/store/SecurityContext";
import {
  Code2, KeyRound, Globe, Users, Terminal,
  ShieldAlert, ShieldCheck, ArrowRight, Zap,
  Play, BookOpen, RotateCcw, Radio
} from "lucide-react";
import clsx from "clsx";
import LogsPanel from "@/components/layout/LogsPanel";
import StatusBar from "@/components/ui/StatusBar";
import SimulateAttackButton from "@/components/ui/SimulateAttackButton";

const modules = [
  {
    id: "xss", label: "XSS Playground", icon: Code2, path: "/xss",
    description: "Inject HTML/JS into unsafe vs sanitized renderers. See real-time output differences.",
    tags: ["innerHTML", "DOMPurify", "CSP"], severity: "critical",
    startHint: 'Try: <img src=x onerror="alert(1)">',
  },
  {
    id: "auth", label: "Auth Simulation", icon: KeyRound, path: "/auth",
    description: "Compare localStorage token storage vs httpOnly cookie simulation.",
    tags: ["JWT", "localStorage", "cookies"], severity: "high",
    startHint: "Login as admin / admin123, then inspect localStorage",
  },
  {
    id: "api-security", label: "API Security", icon: Globe, path: "/api-security",
    description: "Demo unprotected endpoints vs rate-limited, auth-required versions.",
    tags: ["Rate limiting", "Auth headers", "CORS"], severity: "high",
    startHint: "Click Fetch Without Auth — watch it return SSN and salary data",
  },
  {
    id: "rbac", label: "RBAC Demo", icon: Users, path: "/rbac",
    description: "Frontend-only protection vs server-enforced role-based access control.",
    tags: ["Admin", "Roles", "Permissions"], severity: "medium",
    startHint: "Select guest role, then try the Delete action",
  },
  {
    id: "devtools", label: "DevTools Bypass", icon: Terminal, path: "/devtools",
    description: "Show how UI restrictions can be bypassed in DevTools. Then enforce at API.",
    tags: ["DOM manipulation", "JS console", "API validation"], severity: "medium",
    startHint: 'Click "Simulate Bypass" to watch a DevTools attack unfold',
  },
];

const severityColors = {
  critical: { badge: "text-red-400 bg-red-400/10 border-red-400/20",    dot: "bg-red-400" },
  high:     { badge: "text-orange-400 bg-orange-400/10 border-orange-400/20", dot: "bg-orange-400" },
  medium:   { badge: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", dot: "bg-yellow-400" },
};

function resetOnboarding() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("fg_onboarding_done");
    window.location.reload();
  }
}

export default function Dashboard() {
  const { mode, logs, clearLogs, isStreaming } = useSecurity();
  const exploits = logs.filter((l) => l.type === "exploit").length;
  const blocked  = logs.filter((l) => l.type === "blocked").length;
  const total    = logs.length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── Hero banner ── */}
      <div className={clsx(
        "border rounded-2xl p-5 md:p-6 relative overflow-hidden",
        mode === "attack"
          ? "border-red-500/20 bg-gradient-to-br from-red-950/10 to-transparent"
          : "border-emerald-500/20 bg-gradient-to-br from-emerald-950/10 to-transparent"
      )}>
        <div className={clsx(
          "absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl opacity-[0.06] pointer-events-none",
          mode === "attack" ? "bg-red-500" : "bg-emerald-500"
        )} />

        <div className="relative z-10">
          {/* Top row */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-3">
                {mode === "attack"
                  ? <ShieldAlert size={15} className="text-red-400 shrink-0" />
                  : <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
                }
                <span className={clsx(
                  "text-[11px] font-mono font-bold uppercase tracking-widest",
                  mode === "attack" ? "text-red-400" : "text-emerald-400"
                )}>
                  {mode === "attack" ? "Attack Mode Active" : "Secure Mode Active"}
                </span>
                {/* Streaming pulse */}
                {isStreaming && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-600">
                    <Radio size={9} className="text-emerald-500 animate-pulse" />
                    <span className="hidden sm:inline text-emerald-600">monitoring</span>
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                FrontGuard
              </h1>
              <p className="text-zinc-400 text-sm leading-relaxed max-w-lg">
                Pick a module, trigger a real exploit, then toggle to Secure Mode to see the fix.
                Each module explains <em>what</em> is happening, <em>why</em> it&apos;s dangerous, and <em>how</em> to fix it.
              </p>
            </div>

            {/* Live stats */}
            <div className="flex gap-4 md:gap-6 shrink-0 pt-1">
              {[
                { val: exploits, label: "Exploits",   color: "text-red-400" },
                { val: blocked,  label: "Blocked",    color: "text-emerald-400" },
                { val: total,    label: "Total logs", color: "text-zinc-300" },
              ].map(({ val, label, color }) => (
                <div key={label} className="text-center">
                  <div className={clsx("text-xl md:text-2xl font-bold font-mono tabular-nums", color)}>{val}</div>
                  <div className="text-[10px] text-zinc-600 font-mono mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-2 mt-5">
            <Link
              href="/xss"
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-mono font-bold hover:bg-emerald-500/20 transition-all touch-manipulation"
            >
              <Play size={12} /> Start with XSS
            </Link>
            <button
              onClick={resetOnboarding}
              className="flex items-center gap-2 px-4 py-2.5 border border-zinc-800 text-zinc-500 rounded-lg text-xs font-mono hover:border-zinc-600 hover:text-zinc-300 transition-all touch-manipulation"
            >
              <BookOpen size={12} /> Reopen Tour
            </button>
            {/* Simulate attack — prominent placement */}
            <SimulateAttackButton />
            {total > 0 && (
              <button
                onClick={clearLogs}
                className="flex items-center gap-2 px-4 py-2.5 border border-zinc-800 text-zinc-600 rounded-lg text-xs font-mono hover:border-zinc-700 hover:text-zinc-500 transition-all touch-manipulation ml-auto"
              >
                <RotateCcw size={11} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Mode tip */}
        <div className={clsx(
          "relative z-10 mt-4 flex items-start gap-2 text-xs font-mono px-3 py-2.5 rounded-lg border",
          mode === "attack"
            ? "bg-red-500/5 border-red-500/20 text-red-300/80"
            : "bg-emerald-500/5 border-emerald-500/20 text-emerald-300/80"
        )}>
          <Zap size={11} className="shrink-0 mt-0.5" />
          <span>{mode === "attack"
            ? "All modules show vulnerable implementations. Exploits will actually execute. Toggle Secure Mode to see fixes."
            : "All modules show secure implementations. Exploits are neutralized. Compare what changed."
          }</span>
        </div>
      </div>

      {/* ── Status bar ── */}
      <StatusBar />

      {/* ── Module grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Security Modules</p>
          <p className="text-[10px] font-mono text-zinc-700">{modules.length} modules · click to open</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(({ id, label, icon: Icon, path, description, tags, severity, startHint }) => {
            const colors = severityColors[severity as keyof typeof severityColors];
            return (
              <Link
                key={id}
                href={path}
                className="group border border-[#1a1a2e] rounded-xl p-4 md:p-5 bg-[#0d0d18] hover:border-[#2a2a4a] hover:bg-[#0f0f1c] active:scale-[0.98] transition-all duration-200 flex flex-col gap-3 touch-manipulation"
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-zinc-300 transition-all shrink-0">
                    <Icon size={16} />
                  </div>
                  <span className={clsx(
                    "text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1.5",
                    colors.badge
                  )}>
                    <span className={clsx("w-1 h-1 rounded-full shrink-0", colors.dot)} />
                    {severity}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white mb-1.5" style={{ fontFamily: "var(--font-display)" }}>
                    {label}
                  </h3>
                  <p className="text-xs text-zinc-500 leading-relaxed mb-3">{description}</p>
                  <div className="bg-black/30 border border-zinc-800/60 rounded-lg px-3 py-2 text-[10px] font-mono text-zinc-600 group-hover:border-zinc-700 transition-all">
                    <span className="text-zinc-700">{"> "}</span>{startHint}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span key={t} className="text-[10px] font-mono text-zinc-700 bg-white/4 px-1.5 py-0.5 rounded border border-zinc-800/50">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-zinc-700 group-hover:text-zinc-400 transition-colors font-mono">
                  Open module <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Live log ── */}
      <LogsPanel />
    </div>
  );
}
