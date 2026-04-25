"use client";

import { useState, useRef } from "react";
import { useSecurity } from "@/lib/store/SecurityContext";
import { ModeCard, SectionHeader } from "@/components/ui/primitives";
import InfoPanel from "@/components/ui/InfoPanel";
import LogsPanel from "@/components/layout/LogsPanel";
import HintBar from "@/components/ui/HintBar";
import SimulateAttackButton from "@/components/ui/SimulateAttackButton";
import { Play, AlertTriangle, ShieldCheck, RotateCcw } from "lucide-react";
import clsx from "clsx";

const XSS_PAYLOADS = [
  { label: "Alert popup",     value: '<img src=x onerror="alert(\'XSS!\')">'},
  { label: "Cookie stealer",  value: '<script>alert("Cookie: " + document.cookie)</script>' },
  { label: "DOM redirect",    value: '<img src=x onerror="location.href=\'https://example.com\'">' },
  { label: "Style injection", value: '<div style="color:red;font-size:32px;font-weight:bold">HACKED</div>' },
  { label: "Input hijack",    value: '<input onfocus="alert(\'Input hijacked\')" autofocus>' },
];

export default function XSSPage() {
  const { mode, addLog } = useSecurity();
  const [input, setInput] = useState("");
  const [safeOutput, setSafeOutput] = useState("");
  const unsafeRef = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);
  const [renderCount, setRenderCount] = useState(0);

  const sanitize = (raw: string): string => {
    if (typeof window === "undefined") return raw;
    const div = document.createElement("div");
    div.textContent = raw;
    return div.innerHTML;
  };

  const handleRender = () => {
    if (!input.trim()) return;
    setRenderCount((c) => c + 1);

    if (mode === "attack") {
      if (unsafeRef.current) unsafeRef.current.innerHTML = input;
      setSafeOutput(sanitize(input));
      addLog({ type: "exploit", message: "XSS payload injected via innerHTML", detail: input.slice(0, 80), module: "xss" });
      setTriggered(true);
      setTimeout(() => setTriggered(false), 2000);
    } else {
      if (unsafeRef.current) unsafeRef.current.textContent = input;
      setSafeOutput(sanitize(input));
      addLog({ type: "blocked", message: "XSS payload sanitized — rendered as plain text", detail: `Original: ${input.slice(0, 60)}`, module: "xss" });
    }
  };

  const handleReset = () => {
    setInput("");
    setSafeOutput("");
    if (typeof window !== "undefined" && unsafeRef.current) unsafeRef.current.innerHTML = "";
    setRenderCount(0);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionHeader
        title="XSS Playground"
        description="Cross-Site Scripting — inject HTML/JavaScript and see the difference between unsafe innerHTML and sanitized rendering."
      />

        <SimulateAttackButton />
      </div>
      <HintBar module="xss" />

      {/* Quick payloads */}
      <div>
        <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest mb-2">Quick Payloads — click to load</p>
        <div className="flex flex-wrap gap-2">
          {XSS_PAYLOADS.map((p) => (
            <button
              key={p.label}
              onClick={() => setInput(p.value)}
              className="text-xs font-mono text-zinc-400 bg-[#0d0d18] border border-zinc-800 px-3 py-1.5 rounded-lg hover:border-zinc-600 hover:text-zinc-200 transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div>
        <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest block mb-2">Payload Input</label>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRender()}
            placeholder='Try: <img src=x onerror="alert(1)">'
            className="flex-1 bg-[#0d0d18] border border-[#1a1a2e] rounded-xl px-4 py-2.5 text-sm font-mono text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-600 transition-colors"
          />
          <button
            onClick={handleRender}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-bold transition-all",
              mode === "attack"
                ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
            )}
          >
            <Play size={13} /> Render
          </button>
          {renderCount > 0 && (
            <button
              onClick={handleReset}
              className="px-3 py-2.5 rounded-xl text-zinc-600 border border-zinc-800 hover:text-zinc-400 hover:border-zinc-600 transition-all"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Output panels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ModeCard mode="attack" title={mode === "attack" ? "⚠ Unsafe Output (innerHTML)" : "Unsafe Output — Disabled in Secure Mode"}>
          <div
            ref={unsafeRef}
            className={clsx(
              "min-h-[100px] p-4 rounded-xl border text-sm transition-all duration-300",
              triggered && mode === "attack"
                ? "border-red-400 bg-red-400/5 animate-pulse-red"
                : "border-red-500/20 bg-black/20 text-zinc-400"
            )}
          >
            {<span className="text-zinc-700 text-xs font-mono">Rendered output appears here...</span>}
          </div>
          {mode === "attack" && (
            <div className="flex items-center gap-2 text-xs text-orange-400 font-mono bg-orange-400/5 px-3 py-2 rounded-lg border border-orange-400/20">
              <AlertTriangle size={11} />
              JavaScript executes — scripts run in the browser context
            </div>
          )}
        </ModeCard>

        <ModeCard mode="secure" title="Safe Output (textContent / escaped)">
          <div className="min-h-[100px] p-4 rounded-xl border border-emerald-500/20 bg-black/20 text-sm font-mono text-zinc-300 break-all">
            {safeOutput || <span className="text-zinc-700 text-xs">Sanitized output appears here...</span>}
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-400/5 px-3 py-2 rounded-lg border border-emerald-400/20">
            <ShieldCheck size={11} />
            HTML entities escaped — browser renders as plain text
          </div>
        </ModeCard>
      </div>

      {/* Code diff */}
      <div className="border border-[#1a1a2e] rounded-xl overflow-hidden bg-[#0d0d18]">
        <div className="px-4 py-2.5 border-b border-[#1a1a2e] flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Code Comparison</span>
          <span className={clsx("text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border",
            mode === "attack"
              ? "text-red-400 bg-red-400/10 border-red-400/20"
              : "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
          )}>{mode} mode</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-[#1a1a2e]">
          <div className="p-4">
            <p className="text-[10px] font-mono text-red-400 mb-2 uppercase tracking-widest">✗ Vulnerable</p>
            <pre className="text-xs font-mono text-zinc-500 leading-relaxed overflow-x-auto">
{`// Directly sets HTML — dangerous!
element.innerHTML = userInput;

// Any <script> or onerror=
// will execute immediately`}
            </pre>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-mono text-emerald-400 mb-2 uppercase tracking-widest">✓ Fixed</p>
            <pre className="text-xs font-mono text-zinc-500 leading-relaxed overflow-x-auto">
{`// Treats input as text only
element.textContent = userInput;

// Or with DOMPurify for rich text:
element.innerHTML =
  DOMPurify.sanitize(userInput);`}
            </pre>
          </div>
        </div>
      </div>

      <InfoPanel
        what="XSS occurs when user input is rendered as HTML instead of text. The browser parses embedded scripts and executes them — giving attackers full JavaScript access to the page."
        why="innerHTML tells the browser to parse the string as HTML — including <script> tags and event handlers like onerror. Any injected JS runs with full access to your cookies, localStorage, and DOM."
        fix="Use textContent instead of innerHTML for user input. For rich text, use DOMPurify to sanitize. Add a Content-Security-Policy header to restrict which scripts can execute."
        realWorld="XSS caused the 2005 MySpace Samy worm (1M accounts in 20h), the 2018 British Airways breach (500K payment cards stolen), and is listed in the OWASP Top 10 every year since 2003."
      />

      <LogsPanel module="xss" />
    </div>
  );
}
