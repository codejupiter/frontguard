"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Code2, KeyRound, Globe, Users, Terminal,
  LayoutDashboard, ShieldCheck, ExternalLink, X, Menu
} from "lucide-react";
import { useSecurity } from "@/lib/store/SecurityContext";
import clsx from "clsx";
import Image from "next/image";
import { useState, useEffect } from "react";

const modules = [
  { id: "dashboard",    label: "Dashboard",       icon: LayoutDashboard, path: "/" },
  { id: "xss",          label: "XSS Playground",  icon: Code2,           path: "/xss" },
  { id: "auth",         label: "Auth Simulation",  icon: KeyRound,        path: "/auth" },
  { id: "api-security", label: "API Security",     icon: Globe,           path: "/api-security" },
  { id: "rbac",         label: "RBAC",             icon: Users,           path: "/rbac" },
  { id: "devtools",     label: "DevTools Bypass",  icon: Terminal,        path: "/devtools" },
];

const extras = [
  { id: "security-status", label: "Security Status", icon: ShieldCheck,  path: "/security-status" },
  { id: "landing",         label: "Landing Page",    icon: ExternalLink,  path: "/landing" },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { mode } = useSecurity();

  // Close sidebar on route change (mobile)
  useEffect(() => { onClose(); }, [pathname]);

  const activeColor =
    mode === "attack"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  const inactiveColor = "text-zinc-500 hover:text-zinc-200 hover:bg-white/5 border-transparent";

  const navContent = (
    <>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#1a1a2e] flex items-center justify-between">
        <Link href="/" className="block">
          <Image src="/logo.svg" alt="FrontGuard" width={140} height={36} priority className="w-36 h-auto" />
        </Link>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden text-zinc-600 hover:text-zinc-300 transition-colors p-1"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Mode badge */}
      <div className="px-4 py-3 border-b border-[#1a1a2e]">
        <div className={clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border",
          mode === "attack"
            ? "bg-red-500/10 text-red-400 border-red-500/20"
            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        )}>
          <span className={clsx(
            "w-1.5 h-1.5 rounded-full animate-pulse",
            mode === "attack" ? "bg-red-400" : "bg-emerald-400"
          )} />
          {mode === "attack" ? "ATTACK MODE" : "SECURE MODE"}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-widest px-3 mb-2">
          Modules
        </p>
        {modules.map(({ id, label, icon: Icon, path }) => {
          const active = pathname === path;
          return (
            <Link
              key={id}
              href={path}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border",
                active ? activeColor : inactiveColor
              )}
            >
              <Icon size={14} />
              <span className="font-mono text-[13px]">{label}</span>
            </Link>
          );
        })}

        <div className="pt-4 pb-1">
          <p className="text-[10px] text-zinc-700 font-mono uppercase tracking-widest px-3 mb-2">
            More
          </p>
          {extras.map(({ id, label, icon: Icon, path }) => {
            const active = pathname === path;
            return (
              <Link
                key={id}
                href={path}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border",
                  active ? activeColor : inactiveColor
                )}
              >
                <Icon size={14} />
                <span className="font-mono text-[13px]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#1a1a2e]">
        <p className="text-[10px] text-zinc-700 font-mono text-center">Educational use only</p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 min-h-screen bg-[#0a0a0f] border-r border-[#1a1a2e] flex-col shrink-0">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside className={clsx(
        "fixed top-0 left-0 z-50 h-full w-72 bg-[#0a0a0f] border-r border-[#1a1a2e] flex flex-col transition-transform duration-300 ease-in-out md:hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {navContent}
      </aside>
    </>
  );
}

// Exported hamburger button for Topbar to use
export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden w-9 h-9 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all flex items-center justify-center"
      aria-label="Open menu"
    >
      <Menu size={16} />
    </button>
  );
}
