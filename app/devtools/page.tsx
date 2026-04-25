"use client";

import { useState, useEffect, useCallback } from "react";
import { useSecurity } from "@/lib/store/SecurityContext";
import { ModeCard, SectionHeader, StatusBadge } from "@/components/ui/primitives";
import InfoPanel from "@/components/ui/InfoPanel";
import LogsPanel from "@/components/layout/LogsPanel";
import HintBar from "@/components/ui/HintBar";
import SimulateAttackButton from "@/components/ui/SimulateAttackButton";
import { Terminal, Eye, EyeOff, Lock, Unlock, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import clsx from "clsx";

const HIDDEN_AMOUNT = 9999;
const PURCHASE_LIMIT_UI = 500;

export default function DevToolsPage() {
  const { mode, addLog } = useSecurity();
  const [uiPurchaseLimit, setUiPurchaseLimit] = useState(PURCHASE_LIMIT_UI);
  const [amount, setAmount] = useState(100);
  const [purchaseResult, setPurchaseResult] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);

  const addLine = useCallback((line: string) => {
    setConsoleOutput((prev) => [line, ...prev].slice(0, 20));
  }, []);

  // Simulate DevTools manipulation detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    const globalWindow = window as unknown as Record<string, unknown>;

    if (mode === "attack") {
      // In attack mode, expose a global that can be manipulated
      globalWindow.__fg_limit = uiPurchaseLimit;
      globalWindow.__fg_unlock = (val: boolean) => {
        setPremiumUnlocked(val);
        addLine(`> __fg_unlock(${val}) executed — premium: ${val}`);
        addLog({ type: "exploit", message: "Premium feature unlocked via DevTools JS", module: "devtools" });
      };
    }

    return () => {
      delete globalWindow.__fg_limit;
      delete globalWindow.__fg_unlock;
    };
  }, [addLine, addLog, mode, uiPurchaseLimit]);

  const simulateBypass = () => {
    if (mode === "attack") {
      // Simulate what an attacker does in DevTools console
      setUiPurchaseLimit(HIDDEN_AMOUNT);
      setPremiumUnlocked(true);
      addLine("> // Attacker opens DevTools console:");
      addLine(`> document.querySelector('#limit-input').max = '${HIDDEN_AMOUNT}'`);
      addLine(`> window.__fg_limit = ${HIDDEN_AMOUNT}`);
      addLine(`> window.__fg_unlock(true)`);
      addLine(`// Result: purchase limit removed, premium unlocked`);
      addLog({ type: "exploit", message: "UI restriction bypassed via simulated DevTools", detail: `Limit raised from $500 to $${HIDDEN_AMOUNT}`, module: "devtools" });
    }
  };

  const handlePurchase = async () => {
    // Frontend check (bypassable)
    const frontendOk = amount <= uiPurchaseLimit;

    if (mode === "attack") {
      if (!frontendOk) {
        setPurchaseResult("❌ Frontend blocked (but attacker already raised the limit)");
        addLog({ type: "info", message: "Frontend limit triggered", module: "devtools" });
      } else {
        setPurchaseResult(`✅ Purchase of $${amount} processed — no server validation!`);
        addLog({ type: "exploit", message: `Purchase of $${amount} processed without server check`, module: "devtools" });
      }
    } else {
      // Secure: server validates, not the frontend
      try {
        const res = await fetch("/api/rbac?action=write", {
          headers: {
            "x-security-mode": "secure",
            Authorization: "Bearer mock-user-token",
            "x-purchase-amount": String(amount),
          },
        });

        // Simulate server-side limit check
        if (amount > PURCHASE_LIMIT_UI) {
          setPurchaseResult(`❌ Server rejected: $${amount} exceeds allowed limit of $${PURCHASE_LIMIT_UI}`);
          addLog({ type: "blocked", message: `Server blocked purchase of $${amount} — exceeds limit`, module: "devtools" });
        } else if (!res.ok) {
          setPurchaseResult("❌ Server rejected: insufficient permissions");
          addLog({ type: "blocked", message: "Server rejected purchase — no permission", module: "devtools" });
        } else {
          setPurchaseResult(`✅ Server approved purchase of $${amount}`);
          addLog({ type: "request", message: `Server validated and approved $${amount} purchase`, module: "devtools" });
        }
      } catch {
        setPurchaseResult("❌ Request failed");
      }
    }
  };

  const resetBypass = () => {
    setUiPurchaseLimit(PURCHASE_LIMIT_UI);
    setPremiumUnlocked(false);
    setConsoleOutput([]);
    setPurchaseResult(null);
    addLog({ type: "info", message: "DevTools bypass reset", module: "devtools" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionHeader
        title="DevTools Manipulation"
        description="UI restrictions live in JavaScript — anyone can bypass them in DevTools. Server validation is the only real protection."
      />

        <SimulateAttackButton />
      </div>
      <HintBar module="devtools" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Simulated App UI */}
        <div className="border border-[#1a1a2e] rounded-xl bg-[#0d0d15] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a1a2e] flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400">Simulated App</span>
            <StatusBadge secure={mode === "secure"} />
          </div>
          <div className="p-5 space-y-4">
            {/* Premium Feature */}
            <div className={clsx(
              "border rounded-lg p-4 transition-all",
              premiumUnlocked && mode === "attack"
                ? "border-orange-500/40 bg-orange-950/10"
                : mode === "secure"
                  ? "border-emerald-500/20 bg-emerald-950/5"
                  : "border-zinc-800 bg-black/20 opacity-60"
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white font-mono">Premium Feature</span>
                {premiumUnlocked && mode === "attack"
                  ? <Unlock size={14} className="text-orange-400" />
                  : mode === "secure"
                    ? <ShieldCheck size={14} className="text-emerald-400" />
                    : <Lock size={14} className="text-zinc-600" />}
              </div>
              <p className="text-xs text-zinc-500">
                {premiumUnlocked && mode === "attack"
                  ? "⚠ Unlocked via DevTools manipulation — no actual subscription!"
                  : mode === "secure"
                    ? "✓ Access controlled server-side — cannot be bypassed"
                    : "Requires subscription. Hidden behind JS flag: window.__fg_unlock"}
              </p>
            </div>

            {/* Purchase Form */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest block mb-1.5">
                  Purchase Amount (Limit: ${uiPurchaseLimit})
                </label>
                <input
                  id="limit-input"
                  type="number"
                  value={amount}
                  min={1}
                  max={uiPurchaseLimit}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-black/30 border border-[#1a1a2e] rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>
              {amount > PURCHASE_LIMIT_UI && mode === "attack" && (
                <div className="flex items-center gap-2 text-xs text-orange-400 font-mono bg-orange-400/5 px-3 py-2 rounded border border-orange-400/20">
                  <AlertTriangle size={11} />
                  UI limit bypassed! Server would reject this in secure mode.
                </div>
              )}
              <button
                onClick={handlePurchase}
                className={clsx(
                  "w-full py-2 rounded-lg text-sm font-mono font-bold transition-all",
                  mode === "attack"
                    ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                )}
              >
                Purchase
              </button>
              {purchaseResult && (
                <p className="text-xs font-mono text-zinc-300">{purchaseResult}</p>
              )}
            </div>
          </div>
        </div>

        {/* DevTools Console Simulation */}
        <div className="space-y-3">
          <ModeCard mode="attack" title="DevTools Console Simulation">
            <div className="space-y-2">
              <div className="bg-black rounded-lg border border-zinc-800 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
                  <Terminal size={11} className="text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-500">Console</span>
                </div>
                <div className="p-3 h-40 overflow-y-auto space-y-1">
                  {consoleOutput.length === 0 ? (
                    <span className="text-zinc-700 text-[10px] font-mono">Click &quot;Simulate Bypass&quot; to see attacker console commands...</span>
                  ) : (
                    consoleOutput.map((line, i) => (
                      <p key={i} className={clsx(
                        "text-[10px] font-mono",
                        line.startsWith("//") ? "text-zinc-600" : line.startsWith(">") ? "text-emerald-400" : "text-zinc-400"
                      )}>
                        {line}
                      </p>
                    ))
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={simulateBypass}
                  disabled={mode !== "attack"}
                  className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-mono font-bold text-orange-400 bg-orange-400/5 border border-orange-400/20 rounded-lg hover:bg-orange-400/10 transition-all disabled:opacity-30"
                >
                  <Zap size={11} />
                  Simulate Bypass
                </button>
                <button
                  onClick={resetBypass}
                  className="px-3 py-2 text-xs font-mono text-zinc-600 bg-white/5 border border-zinc-800 rounded-lg hover:text-zinc-400 transition-all"
                >
                  Reset
                </button>
              </div>
            </div>
          </ModeCard>

          {/* Hidden data exposure */}
          <ModeCard mode="attack" title="Hidden Data in DOM">
            <div className="space-y-2">
              <div className="bg-black/30 border border-red-500/20 rounded-lg p-3 text-[10px] font-mono text-zinc-500 space-y-1">
                {/* Hidden data that DevTools can reveal */}
                <p>{"<input type=\"hidden\" name=\"admin_key\""}</p>
                <p className="text-zinc-700">{"  value=\"sk_live_abc123...\" />"}</p>
                <button
                  onClick={() => {
                    setShowHidden((s) => !s);
                    addLog({ type: "exploit", message: "Hidden field value revealed via DOM inspection", module: "devtools" });
                  }}
                  className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 transition-colors mt-2"
                >
                  {showHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                  {showHidden ? "Hide value" : "Inspect hidden field"}
                </button>
                {showHidden && (
                  <p className="text-red-400 mt-1">{'value="sk_live_xK9mP3abc123secretkey" ← Never put secrets in HTML!'}</p>
                )}
              </div>
            </div>
          </ModeCard>
        </div>
      </div>

      <InfoPanel
        what="Any JavaScript variable, HTML attribute, or DOM property can be read and modified by anyone with browser DevTools access. UI restrictions (disabled buttons, hidden fields, JS flags) are purely cosmetic."
        why="Attackers can: raise form input limits by editing HTML attributes, set JavaScript variables to unlock premium features, read hidden input fields containing secrets, and bypass client-side validation entirely."
        fix="Never trust the client. All business logic, limits, and access checks must be validated on the server. Never store secrets in HTML. Treat all input as potentially manipulated. The server is the source of truth."
        realWorld="Games have been hacked by editing in-memory values (Cheat Engine). E-commerce sites have been exploited by changing price fields. API keys have been stolen from hidden form fields. This is one of the most common real-world attack surfaces."
      />

      <LogsPanel module="devtools" />
    </div>
  );
}
