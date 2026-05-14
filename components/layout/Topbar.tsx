"use client";

import { useSecurity } from "@/lib/store/SecurityContext";
import { ShieldAlert, ShieldCheck, Bell, HelpCircle, ExternalLink, Menu } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

function reopenOnboarding() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("fg_onboarding_done");
    window.location.reload();
  }
}

interface TopbarProps {
  onMenuClick: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { mode, toggleMode, logs } = useSecurity();
  const unreadExploits = logs.filter((l) => l.type === "exploit").length;

  return (
    <header className="h-14 bg-[#0a0a0f]/80 backdrop-blur border-b border-[#1a1a2e] flex items-center justify-between px-4 md:px-6 sticky top-0 z-20 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden w-9 h-9 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all flex items-center justify-center shrink-0"
          aria-label="Open menu"
        >
          <Menu size={16} />
        </button>

        <div className="text-zinc-600 text-xs font-mono hidden lg:block">
          <span className="text-zinc-700">{"// "}</span>Frontend Security Playground
        </div>
        <Link
          href="/landing"
          className="text-[10px] font-mono text-zinc-700 hover:text-zinc-500 transition-colors items-center gap-1 hidden sm:flex"
        >
          <ExternalLink size={10} /> View landing
        </Link>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {unreadExploits > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-orange-400 font-mono bg-orange-400/10 px-2.5 py-1 rounded-lg border border-orange-400/20">
            <Bell size={11} />
            <span>{unreadExploits} exploit{unreadExploits !== 1 ? "s" : ""}</span>
          </div>
        )}

        <button
          onClick={reopenOnboarding}
          title="Reopen tour"
          className="w-9 h-9 rounded-lg border border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-600 transition-all flex items-center justify-center"
        >
          <HelpCircle size={14} />
        </button>

        <button
          onClick={toggleMode}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all duration-300",
            mode === "attack"
              ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
          )}
        >
          {mode === "attack" ? (
            <><ShieldAlert size={13} /><span className="hidden sm:inline">Switch to Secure</span><span className="sm:hidden">Secure</span></>
          ) : (
            <><ShieldCheck size={13} /><span className="hidden sm:inline">Switch to Attack</span><span className="sm:hidden">Attack</span></>
          )}
        </button>
      </div>
    </header>
  );
}
