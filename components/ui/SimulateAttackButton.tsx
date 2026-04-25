"use client";

import { useSecurity } from "@/lib/store/SecurityContext";
import { Zap, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useState, useEffect, useRef } from "react";

export default function SimulateAttackButton() {
  const { simulateAttack } = useSecurity();
  const [phase, setPhase] = useState<"idle" | "running" | "cooldown">("idle");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleClick = () => {
    if (phase !== "idle") return;

    setPhase("running");
    simulateAttack();

    // Attack burst: 7 events × 350ms = 2450ms total, then 3s pause = 5450ms
    const BURST_DURATION = 7 * 350 + 3000;

    setTimeout(() => {
      setPhase("cooldown");
      setCooldown(8);

      cooldownRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(cooldownRef.current!);
            setPhase("idle");
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, BURST_DURATION);
  };

  return (
    <button
      onClick={handleClick}
      disabled={phase !== "idle"}
      className={clsx(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold border transition-all duration-200 touch-manipulation relative overflow-hidden select-none",
        phase === "running"
          ? "bg-red-500/20 text-red-300 border-red-500/40 cursor-wait"
          : phase === "cooldown"
          ? "bg-zinc-800/40 text-zinc-600 border-zinc-800 cursor-not-allowed"
          : "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-300 active:scale-95"
      )}
    >
      {phase === "running" && (
        <span className="absolute inset-0 animate-shimmer opacity-30 pointer-events-none" />
      )}
      {phase === "running" ? (
        <><Loader2 size={12} className="animate-spin shrink-0" /> Injecting…</>
      ) : phase === "cooldown" ? (
        <><Zap size={12} className="shrink-0" /> Cooldown {cooldown}s</>
      ) : (
        <><Zap size={12} className="shrink-0" /> Simulate Attack</>
      )}
    </button>
  );
}
