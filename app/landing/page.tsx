"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Shield, Code2, KeyRound, Globe, Users, Terminal,
  ArrowRight, ChevronRight, Zap, Lock, Eye, AlertTriangle,
  CheckCircle, ExternalLink
} from "lucide-react";

const TYPING_LINES = [
  '<img src=x onerror="alert(document.cookie)">',
  "localStorage.getItem('auth_token')",
  "window.__role = 'admin'  // instant privilege escalation",
  "GET /api/users  // no auth required — 2.1M records exposed",
  'document.querySelector("#price").value = "0.01"',
];

const MODULES = [
  { icon: Code2,    label: "XSS Playground",    color: "text-red-400",    bg: "bg-red-400/10",    border: "border-red-400/20",    desc: "Inject real payloads. Watch them execute.", severity: "critical" },
  { icon: KeyRound, label: "Auth Simulation",    color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", desc: "localStorage vs httpOnly cookies.", severity: "high" },
  { icon: Globe,    label: "API Security",       color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", desc: "No-auth endpoints. Rate limit bypass.", severity: "high" },
  { icon: Users,    label: "RBAC Demo",          color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", desc: "Bypass frontend-only role checks.", severity: "medium" },
  { icon: Terminal, label: "DevTools Bypass",    color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20", desc: "Edit the DOM. Change prices. Unlock features.", severity: "medium" },
];

const REAL_WORLD = [
  { year: "2005", event: "MySpace Samy Worm", type: "XSS", impact: "1M profiles infected in 20 hours via self-propagating XSS payload" },
  { year: "2018", event: "British Airways Breach", type: "XSS", impact: "500K customers' payment details stolen in real-time via JS skimmer" },
  { year: "2021", event: "LinkedIn Scrape", type: "API", impact: "700M user records extracted through an unauthenticated API endpoint" },
  { year: "2021", event: "Facebook Leak", type: "API", impact: "533M records exposed via an API with no rate limiting on phone lookups" },
  { year: "2021", event: "Peloton API", type: "API", impact: "Private user data publicly accessible with zero authentication required" },
];

function TypingAnimation() {
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    const line = TYPING_LINES[lineIndex];
    if (charIndex < line.length) {
      const t = setTimeout(() => {
        setDisplayed(line.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      }, 35);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setCharIndex(0);
        setDisplayed("");
        setLineIndex((i) => (i + 1) % TYPING_LINES.length);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [charIndex, lineIndex]);

  return (
    <div className="bg-black rounded-xl border border-zinc-800 overflow-hidden scanlines relative">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <span className="w-3 h-3 rounded-full bg-red-500/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-[10px] font-mono text-zinc-600">attacker-console.js</span>
      </div>
      <div className="p-5 min-h-[80px] flex items-center">
        <div className="text-sm font-mono">
          <span className="text-zinc-600">{">"} </span>
          <span className="text-red-400">{displayed}</span>
          <span className="animate-blink text-emerald-400">▊</span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden">
      {/* Grid bg */}
      <div className="fixed inset-0 grid-bg opacity-100 pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 border-b border-[#1a1a2e] bg-[#080810]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="FrontGuard" className="h-9 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/codejupiter/frontguard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              GitHub ↗
            </a>
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-mono font-bold hover:bg-emerald-500/20 transition-all"
            >
              Launch App <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="animate-fadeInUp">
              <div className="inline-flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Interactive Security Education Platform
              </div>

              <h1 className="text-6xl font-black mb-6 leading-none" style={{ fontFamily: "var(--font-display)" }}>
                <span className="text-white">Hack it.</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  Fix it.
                </span>
                <br />
                <span className="text-white">Ship it</span>
                <span className="text-emerald-400">.</span>
              </h1>

              <p className="text-zinc-400 text-lg leading-relaxed mb-8 max-w-lg">
                FrontGuard lets you trigger real frontend security exploits in a safe sandbox — then see exactly how to fix them. Built for developers who learn by doing.
              </p>

              <div className="flex items-center gap-3">
                <Link
                  href="/"
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-mono font-bold rounded-xl hover:bg-emerald-400 transition-all text-sm shadow-lg shadow-emerald-500/20"
                >
                  Start Learning <ArrowRight size={15} />
                </Link>
                <a
                  href="#modules"
                  className="flex items-center gap-2 px-6 py-3 border border-zinc-700 text-zinc-300 font-mono text-sm rounded-xl hover:border-zinc-500 hover:text-white transition-all"
                >
                  Explore Modules <ChevronRight size={14} />
                </a>
              </div>

              <div className="flex items-center gap-6 mt-10">
                {[
                  { val: "5", label: "Vulnerabilities" },
                  { val: "10+", label: "Live Exploits" },
                  { val: "0", label: "Setup Required" },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <div className="text-2xl font-bold text-white font-mono">{val}</div>
                    <div className="text-[11px] text-zinc-600 font-mono">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 animate-fadeInUp" style={{ animationDelay: "0.15s" }}>
              <TypingAnimation />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-red-500/20 bg-red-950/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} className="text-red-400" />
                    <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-widest">Attack Mode</span>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono">Vulnerable implementations. Real exploits. No restrictions.</p>
                </div>
                <div className="border border-emerald-500/20 bg-emerald-950/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={13} className="text-emerald-400" />
                    <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest">Secure Mode</span>
                  </div>
                  <p className="text-xs text-zinc-500 font-mono">Fixed implementations. See exactly what the patch looks like.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="relative z-10 py-20 px-6 border-t border-[#1a1a2e]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">What you&apos;ll learn</p>
            <h2 className="text-4xl font-black text-white mb-4" style={{ fontFamily: "var(--font-display)" }}>
              5 Security Modules
            </h2>
            <p className="text-zinc-500 text-sm max-w-lg mx-auto">
              Each module has a live exploit, a secure fix, and real-world context. Toggle between modes with one click.
            </p>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {MODULES.map(({ icon: Icon, label, color, bg, border, desc, severity }, i) => (
              <div
                key={label}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={`border rounded-xl p-5 cursor-pointer transition-all duration-300 ${border} ${
                  hovered === i ? bg : "bg-[#0d0d18] border-[#1a1a2e]"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg ${hovered === i ? bg : "bg-white/5"} flex items-center justify-center mb-4 transition-all`}>
                  <Icon size={16} className={hovered === i ? color : "text-zinc-600"} />
                </div>
                <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-2 ${
                  severity === "critical" ? "text-red-500" : severity === "high" ? "text-orange-400" : "text-yellow-400"
                }`}>{severity}</div>
                <h3 className="text-xs font-bold text-white mb-1.5" style={{ fontFamily: "var(--font-display)" }}>{label}</h3>
                <p className="text-[11px] text-zinc-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-zinc-700 text-zinc-300 font-mono text-sm rounded-xl hover:border-zinc-500 hover:text-white transition-all"
            >
              Open All Modules <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* Real World Incidents */}
      <section className="relative z-10 py-20 px-6 border-t border-[#1a1a2e]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">Why this matters</p>
            <h2 className="text-4xl font-black text-white mb-4" style={{ fontFamily: "var(--font-display)" }}>
              Real Breaches. Real Damage.
            </h2>
            <p className="text-zinc-500 text-sm max-w-lg mx-auto">
              These aren&apos;t theoretical. Every vulnerability in FrontGuard has caused real-world incidents.
            </p>
          </div>

          <div className="space-y-3">
            {REAL_WORLD.map(({ year, event, type, impact }) => (
              <div
                key={event}
                className="flex items-start gap-6 border border-[#1a1a2e] bg-[#0d0d18] rounded-xl px-6 py-4 hover:border-zinc-700 transition-all group"
              >
                <span className="text-zinc-700 font-mono text-sm w-12 shrink-0 pt-0.5">{year}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white font-bold text-sm group-hover:text-zinc-100 transition-colors" style={{ fontFamily: "var(--font-display)" }}>{event}</span>
                    <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                      type === "XSS"
                        ? "text-red-400 bg-red-400/10 border-red-400/20"
                        : "text-orange-400 bg-orange-400/10 border-orange-400/20"
                    }`}>{type}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{impact}</p>
                </div>
                <ExternalLink size={13} className="text-zinc-700 group-hover:text-zinc-500 transition-colors shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 py-20 px-6 border-t border-[#1a1a2e]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-4xl font-black text-white mb-14" style={{ fontFamily: "var(--font-display)" }}>
            Three steps to understanding security
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { step: "01", icon: Eye,    title: "Attack",   desc: "Switch to Attack Mode and trigger a real exploit. See what an attacker sees.",   color: "text-red-400",    bg: "bg-red-400/10" },
              { step: "02", icon: Zap,    title: "Observe",  desc: "Watch the security log. See exactly what happened — token stolen, script executed.", color: "text-orange-400", bg: "bg-orange-400/10" },
              { step: "03", icon: Lock,   title: "Fix",      desc: "Switch to Secure Mode. See the exact code change that neutralizes the attack.",     color: "text-emerald-400",bg: "bg-emerald-400/10" },
            ].map(({ step, icon: Icon, title, desc, color, bg }) => (
              <div key={step} className="text-center">
                <div className={`w-14 h-14 rounded-2xl ${bg} flex items-center justify-center mx-auto mb-5`}>
                  <Icon size={22} className={color} />
                </div>
                <div className="text-[10px] font-mono text-zinc-700 mb-2">{step}</div>
                <h3 className="text-lg font-bold text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6 border-t border-[#1a1a2e]">
        <div className="max-w-3xl mx-auto text-center">
          <div className="border border-emerald-500/20 bg-emerald-950/10 rounded-2xl p-12">
            <img src="/logo-icon.svg" alt="FrontGuard" className="w-20 h-20 mx-auto mb-6" />
            <h2 className="text-4xl font-black text-white mb-4" style={{ fontFamily: "var(--font-display)" }}>
              Ready to break things?
            </h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              No login. No setup. Just open the app and start exploring the most common ways frontend apps get compromised.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-500 text-black font-mono font-black rounded-xl hover:bg-emerald-400 transition-all text-sm shadow-xl shadow-emerald-500/20"
            >
              Launch FrontGuard <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#1a1a2e] py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.svg" alt="" className="w-4 h-4 opacity-40" />
            <span className="text-xs font-mono text-zinc-700">FrontGuard — Educational use only. No real systems are harmed.</span>
          </div>
          <span className="text-xs font-mono text-zinc-700">Built by Zoriah Cocio</span>
        </div>
      </footer>
    </div>
  );
}
