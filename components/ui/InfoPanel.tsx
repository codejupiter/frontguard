"use client";

import { BookOpen, AlertTriangle, ShieldCheck, Globe } from "lucide-react";

interface InfoPanelProps {
  what: string;
  why: string;
  fix: string;
  realWorld: string;
}

export default function InfoPanel({ what, why, fix, realWorld }: InfoPanelProps) {
  const sections = [
    { icon: BookOpen, label: "What's happening", text: what, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
    { icon: AlertTriangle, label: "Why it's vulnerable", text: why, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
    { icon: ShieldCheck, label: "How it's fixed", text: fix, color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    { icon: Globe, label: "Real-world context", text: realWorld, color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sections.map(({ icon: Icon, label, text, color }) => (
        <div key={label} className={`border rounded-xl p-4 ${color}`}>
          <div className="flex items-center gap-2 mb-2">
            <Icon size={13} />
            <span className="text-xs font-mono font-bold uppercase tracking-wide">{label}</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  );
}
