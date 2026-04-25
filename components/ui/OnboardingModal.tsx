"use client";

import { useState, useEffect } from "react";
import { Shield, ArrowRight, Code2, KeyRound, Globe, Users, Terminal, X, ChevronLeft } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

const STORAGE_KEY = "fg_onboarding_done";

const STEPS = [
  {
    id: "welcome",
    title: "Welcome to FrontGuard",
    subtitle: "Frontend Security Playground",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-400 text-sm leading-relaxed">
          FrontGuard lets you <span className="text-white font-bold">trigger real security exploits</span> in a safe sandbox — then instantly see the fix.
        </p>
        <p className="text-zinc-400 text-sm leading-relaxed">
          No setup. No login. Just click, break things, and learn why they broke.
        </p>
        <div className="border border-zinc-800 rounded-xl p-4 bg-black/20">
          <p className="text-[11px] font-mono text-zinc-600 mb-3 uppercase tracking-widest">This app covers:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: Code2,    label: "XSS Attacks" },
              { icon: KeyRound, label: "Auth Token Storage" },
              { icon: Globe,    label: "API Security" },
              { icon: Users,    label: "RBAC Bypasses" },
              { icon: Terminal, label: "DevTools Manipulation" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-zinc-300">
                <Icon size={13} className="text-emerald-400 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "modes",
    title: "Two Modes, One Truth",
    subtitle: "Attack → Secure",
    content: (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-4">
          <p className="text-red-400 text-xs font-mono font-bold uppercase tracking-widest mb-1">Attack Mode</p>
          <p className="text-zinc-400 text-sm">Real vulnerabilities active. Payloads execute. See what attackers actually see.</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <p className="text-emerald-400 text-xs font-mono font-bold uppercase tracking-widest mb-1">Secure Mode</p>
          <p className="text-zinc-400 text-sm">Same inputs, same payloads — but properly defended. Compare the code diff.</p>
        </div>
        <p className="text-zinc-500 text-xs font-mono">Toggle between modes using the button in the top right corner.</p>
      </div>
    ),
  },
  {
    id: "logs",
    title: "Live Security Log",
    subtitle: "Watch events stream in real time",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-400 text-sm leading-relaxed">
          Every action you take — and every attack you trigger — appears in the live log at the bottom of each page.
        </p>
        <div className="space-y-1.5 font-mono text-xs border border-zinc-800 rounded-xl p-3 bg-black/20">
          {[
            { type: "exploit", msg: "DOM mutation via innerHTML on #content" },
            { type: "blocked", msg: "XSS payload neutralized by DOMPurify" },
            { type: "info",    msg: "CSP policy evaluated" },
          ].map(({ type, msg }) => (
            <div key={msg} className="flex items-center gap-2">
              <span className={clsx(
                "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border",
                type === "exploit" ? "text-red-400 bg-red-400/10 border-red-400/20" :
                type === "blocked" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" :
                "text-zinc-400 bg-zinc-400/10 border-zinc-700"
              )}>{type}</span>
              <span className="text-zinc-400 truncate">{msg}</span>
            </div>
          ))}
        </div>
        <p className="text-zinc-500 text-xs font-mono">Click any log entry to expand its full details.</p>
      </div>
    ),
  },
  {
    id: "start",
    title: "You're ready.",
    subtitle: "Start with XSS — it's the most visual",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-400 text-sm leading-relaxed">
          Head to the <span className="text-white font-bold">XSS Playground</span> and paste this payload into the input:
        </p>
        <div className="bg-black/40 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-red-300">
          {'<img src=x onerror="alert(\'XSS\')">'}
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Watch it execute in the unsafe renderer — then toggle to Secure Mode to see it blocked.
        </p>
        <p className="text-zinc-600 text-xs font-mono">Hit the <span className="text-zinc-400">?</span> button any time to reopen this tour.</p>
      </div>
    ),
  },
];

export default function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Mount guard — prevents SSR/localStorage mismatch that causes hydration errors
  useEffect(() => {
    if (typeof window === "undefined") return;

    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay so layout renders first
      const timer = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const close = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
    setStep(0);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else close();
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  if (!open) return null;

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-lg bg-[#0d0d18] border border-[#1e1e3a] rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base" style={{ fontFamily: "var(--font-display)" }}>
                {current.title}
              </h2>
              <p className="text-zinc-500 text-xs font-mono mt-0.5">{current.subtitle}</p>
            </div>
          </div>
          <button
            onClick={close}
            className="text-zinc-600 hover:text-zinc-400 transition-colors p-1 touch-manipulation"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-2">{current.content}</div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 pt-4 border-t border-zinc-800/50">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={clsx(
                  "rounded-full transition-all touch-manipulation",
                  i === step
                    ? "w-4 h-1.5 bg-emerald-400"
                    : "w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500"
                )}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={back}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-lg transition-all touch-manipulation"
              >
                <ChevronLeft size={12} /> Back
              </button>
            )}
            {step === STEPS.length - 1 ? (
              <Link
                href="/xss"
                onClick={close}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-lg transition-all touch-manipulation"
              >
                Start with XSS <ArrowRight size={12} />
              </Link>
            ) : (
              <button
                onClick={next}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-lg transition-all touch-manipulation"
              >
                Next <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
