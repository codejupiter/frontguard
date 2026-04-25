"use client";

import { SecurityMode } from "@/types";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { ReactNode } from "react";

interface ModeCardProps {
  mode: SecurityMode;
  title: string;
  children: ReactNode;
}

export function ModeCard({ mode, title, children }: ModeCardProps) {
  const isAttack = mode === "attack";
  return (
    <div className={clsx(
      "rounded-xl border p-4 md:p-5 flex flex-col gap-4 min-w-0",
      isAttack
        ? "bg-red-950/10 border-red-500/20"
        : "bg-emerald-950/10 border-emerald-500/20"
    )}>
      <div className={clsx(
        "flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest",
        isAttack ? "text-red-400" : "text-emerald-400"
      )}>
        {isAttack ? <ShieldAlert size={13} /> : <ShieldCheck size={13} />}
        <span className="truncate">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function StatusBadge({ secure }: { secure: boolean }) {
  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border",
      secure
        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
        : "text-red-400 bg-red-400/10 border-red-400/20"
    )}>
      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", secure ? "bg-emerald-400" : "bg-red-400")} />
      {secure ? "Secure" : "Vulnerable"}
    </span>
  );
}

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-xl md:text-2xl font-bold text-white font-mono tracking-tight mb-1">{title}</h1>
      <p className="text-zinc-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
