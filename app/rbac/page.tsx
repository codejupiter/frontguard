"use client";

import { useState } from "react";
import { useSecurity } from "@/lib/store/SecurityContext";
import { ModeCard, SectionHeader, StatusBadge } from "@/components/ui/primitives";
import InfoPanel from "@/components/ui/InfoPanel";
import LogsPanel from "@/components/layout/LogsPanel";
import HintBar from "@/components/ui/HintBar";
import SimulateAttackButton from "@/components/ui/SimulateAttackButton";
import { generateMockToken, hasPermission } from "@/lib/security/utils";
import { Users, ShieldOff, ShieldCheck, Play, Lock, Unlock } from "lucide-react";
import clsx from "clsx";

type Role = "admin" | "user" | "guest";

const ACTIONS = [
  { id: "read", label: "Read Data", icon: "📖" },
  { id: "write", label: "Write Data", icon: "✏️" },
  { id: "delete", label: "Delete Record", icon: "🗑️" },
  { id: "manage", label: "Manage Users", icon: "👥" },
];

const ROLE_COLORS: Record<Role, string> = {
  admin: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  user: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  guest: "text-zinc-400 bg-zinc-400/10 border-zinc-400/30",
};

export default function RBACPage() {
  const { mode, addLog } = useSecurity();
  const [selectedRole, setSelectedRole] = useState<Role>("guest");
  const [lastResult, setLastResult] = useState<{ action: string; allowed: boolean; message: string } | null>(null);

  const simulateAction = async (actionId: string) => {
    const token = generateMockToken("demo-user", selectedRole);

    if (mode === "attack") {
      // Frontend-only: no server validation, just check in JS
      const allowed = hasPermission(selectedRole, actionId);
      // But in attack mode, a user could just change the role in JS!
      const result = { action: actionId, allowed, message: allowed
        ? `Frontend says: ALLOWED for ${selectedRole}`
        : `Frontend says: DENIED for ${selectedRole} — but this can be bypassed!`
      };
      setLastResult(result);
      if (allowed) {
        addLog({ type: "exploit", message: `RBAC bypassed client-side — action '${actionId}' as ${selectedRole}`, detail: "No server validation", module: "rbac" });
      } else {
        addLog({ type: "info", message: `Frontend blocked '${actionId}' for ${selectedRole}`, module: "rbac" });
      }
    } else {
      // Secure: backend validates the token
      try {
        const res = await fetch(`/api/rbac?action=${actionId}`, {
          headers: {
            "x-security-mode": "secure",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        const allowed = res.ok;
        setLastResult({ action: actionId, allowed, message: data.message ?? data.error });
        if (allowed) {
          addLog({ type: "request", message: `Server allowed '${actionId}' for role '${selectedRole}'`, module: "rbac" });
        } else {
          addLog({ type: "blocked", message: `Server blocked '${actionId}' for role '${selectedRole}'`, detail: data.error, module: "rbac" });
        }
      } catch {
        addLog({ type: "error", message: "RBAC API request failed", module: "rbac" });
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionHeader
        title="Role-Based Access Control"
        description="Frontend-only RBAC can be bypassed trivially. Compare against server-validated token-based enforcement."
      />

        <SimulateAttackButton />
      </div>
      <HintBar module="rbac" />

      {/* Role Selector */}
      <div>
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-3">Select Role to Simulate</p>
        <div className="flex gap-3">
          {(["admin", "user", "guest"] as Role[]).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-bold border transition-all",
                selectedRole === role
                  ? ROLE_COLORS[role]
                  : "text-zinc-600 bg-transparent border-zinc-800 hover:border-zinc-600 hover:text-zinc-400"
              )}
            >
              <Users size={13} />
              {role}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Attack: frontend-only */}
        <ModeCard mode="attack" title="Frontend-Only Check">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <ShieldOff size={11} className="text-red-400" />
              Role check in JavaScript only — trivially bypassable
            </div>
            <div className="bg-black/30 border border-red-500/20 rounded-lg p-3 text-[10px] font-mono text-zinc-500 space-y-1">
              <p className="text-red-300">// In browser console:</p>
              <p>window.__role = "admin"</p>
              <p className="text-zinc-600">// Access granted instantly</p>
            </div>
            <div className="space-y-1.5">
              {ACTIONS.map((a) => {
                const allowed = hasPermission(selectedRole, a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-zinc-800">
                    <span className="text-xs font-mono text-zinc-300">{a.icon} {a.label}</span>
                    {allowed
                      ? <Unlock size={12} className="text-orange-400" />
                      : <Lock size={12} className="text-zinc-600" />}
                  </div>
                );
              })}
            </div>
          </div>
        </ModeCard>

        {/* Secure: server-validated */}
        <ModeCard mode="secure" title="Server-Enforced Check">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <ShieldCheck size={11} className="text-emerald-400" />
              Role decoded from signed JWT on the server
            </div>
            <div className="bg-black/30 border border-emerald-500/20 rounded-lg p-3 text-[10px] font-mono text-zinc-500 space-y-1">
              <p className="text-emerald-300">// Server decodes your JWT:</p>
              <p>const role = verify(token, SECRET)</p>
              <p className="text-zinc-600">// Client cannot forge this</p>
            </div>
            <div className="space-y-1.5">
              {ACTIONS.map((a) => {
                const allowed = hasPermission(selectedRole, a.id);
                return (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-zinc-800">
                    <span className="text-xs font-mono text-zinc-300">{a.icon} {a.label}</span>
                    {allowed
                      ? <ShieldCheck size={12} className="text-emerald-400" />
                      : <Lock size={12} className="text-zinc-600" />}
                  </div>
                );
              })}
            </div>
          </div>
        </ModeCard>
      </div>

      {/* Action Buttons */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Test Actions</p>
          <StatusBadge secure={mode === "secure"} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => simulateAction(a.id)}
              className={clsx(
                "flex flex-col items-center gap-2 p-3 rounded-xl border text-xs font-mono transition-all",
                mode === "attack"
                  ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                  : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
              )}
            >
              <span className="text-lg">{a.icon}</span>
              <span>{a.label}</span>
              <Play size={10} />
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {lastResult && (
        <div className={clsx(
          "border rounded-xl p-4 font-mono text-sm transition-all",
          lastResult.allowed
            ? "border-emerald-500/30 bg-emerald-950/10 text-emerald-300"
            : "border-red-500/30 bg-red-950/10 text-red-300"
        )}>
          <div className="flex items-center gap-2 mb-1">
            {lastResult.allowed ? <ShieldCheck size={14} /> : <Lock size={14} />}
            <span className="font-bold uppercase text-[10px] tracking-widest">
              {lastResult.allowed ? "Allowed" : "Denied"}
            </span>
            <span className="text-zinc-600">— action: {lastResult.action}</span>
          </div>
          <p className="text-xs text-zinc-400">{lastResult.message}</p>
        </div>
      )}

      <InfoPanel
        what="RBAC restricts what actions a user can perform based on their role. A frontend-only check shows/hides UI buttons based on the role stored in JavaScript — but this is just cosmetic."
        why="JavaScript runs in the browser. Anyone can open DevTools, change a variable from 'guest' to 'admin', and bypass any client-side check. The frontend is an untrusted environment."
        fix="Always enforce permissions on the server. Use a signed JWT — the server decodes the role from the token and checks permissions before executing any action. The client cannot forge a server-signed token."
        realWorld="Many early SPA applications put admin routes behind a simple JS check like if (user.role === 'admin'). Attackers bypassed this by editing localStorage or JS variables directly in the console."
      />

      <LogsPanel module="rbac" />
    </div>
  );
}
