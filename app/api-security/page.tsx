"use client";

import { useState } from "react";
import { useSecurity } from "@/lib/store/SecurityContext";
import { ModeCard, SectionHeader, StatusBadge } from "@/components/ui/primitives";
import InfoPanel from "@/components/ui/InfoPanel";
import LogsPanel from "@/components/layout/LogsPanel";
import HintBar from "@/components/ui/HintBar";
import SimulateAttackButton from "@/components/ui/SimulateAttackButton";
import { Play, Globe, Lock, Zap, CheckCircle, XCircle } from "lucide-react";
import clsx from "clsx";

interface RequestLog {
  id: string;
  status: number;
  time: number;
  response: unknown;
  blocked: boolean;
}

export default function APISecurityPage() {
  const { mode, addLog } = useSecurity();
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [spamCount, setSpamCount] = useState(0);

  const makeRequest = async (withAuth = false) => {
    setLoading(true);
    const start = Date.now();

    try {
      const headers: Record<string, string> = {
        "x-security-mode": mode,
        ...(withAuth && { Authorization: "Bearer mock-token-for-demo" }),
        ...(mode === "attack" && { "x-client-role": "admin" }),
      };

      const res = await fetch("/api/logs", { headers });
      const data = await res.json();
      const elapsed = Date.now() - start;

      const entry: RequestLog = {
        id: Math.random().toString(36).slice(2),
        status: res.status,
        time: elapsed,
        response: data,
        blocked: res.status === 429 || res.status === 401,
      };

      setRequestLogs((prev) => [entry, ...prev].slice(0, 10));

      if (res.status === 401) {
        addLog({ type: "blocked", message: "API request blocked — no auth token", detail: `Status: 401`, module: "api-security" });
      } else if (res.status === 429) {
        addLog({ type: "blocked", message: "Rate limit triggered — request denied", detail: `Status: 429`, module: "api-security" });
      } else if (mode === "attack") {
        addLog({ type: "exploit", message: "Unauthenticated request succeeded — sensitive data exposed", detail: `${JSON.stringify(data).slice(0, 80)}`, module: "api-security" });
      } else {
        addLog({ type: "request", message: "Authenticated request completed", detail: `${elapsed}ms — ${res.status}`, module: "api-security" });
      }
    } catch {
      addLog({ type: "error", message: "Request failed", module: "api-security" });
    } finally {
      setLoading(false);
    }
  };

  const simulateSpam = async () => {
    setSpamCount(0);
    for (let i = 0; i < 6; i++) {
      await makeRequest(mode === "secure");
      setSpamCount((c) => c + 1);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionHeader
        title="API Security Demo"
        description="Demonstrate unauthenticated, rate-limit-free endpoints vs protected, rate-limited endpoints."
      />

        <SimulateAttackButton />
      </div>
      <HintBar module="api-security" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Attack: No auth */}
        <ModeCard mode="attack" title="Insecure Endpoint">
          <div className="space-y-3">
            <div className="text-xs font-mono text-zinc-500 space-y-1">
              <div className="flex items-center gap-2">
                <Globe size={11} className="text-red-400" />
                <code className="text-red-300">GET /api/logs</code>
              </div>
              <div className="pl-5 space-y-0.5 text-zinc-600">
                <p>✗ No authentication required</p>
                <p>✗ No rate limiting</p>
                <p>✗ Full data exposure (SSN, salary)</p>
              </div>
            </div>
            <button
              onClick={() => makeRequest(false)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-mono font-bold text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-all disabled:opacity-50"
            >
              <Play size={12} />
              {mode === "attack" ? "Fetch Without Auth (exploit)" : "Fetch Without Auth"}
            </button>
          </div>
        </ModeCard>

        {/* Secure: Auth + rate limit */}
        <ModeCard mode="secure" title="Secure Endpoint">
          <div className="space-y-3">
            <div className="text-xs font-mono text-zinc-500 space-y-1">
              <div className="flex items-center gap-2">
                <Lock size={11} className="text-emerald-400" />
                <code className="text-emerald-300">GET /api/logs</code>
              </div>
              <div className="pl-5 space-y-0.5 text-zinc-600">
                <p>✓ Bearer token required</p>
                <p>✓ Rate limit: 3 req / 10s</p>
                <p>✓ SSN and salary stripped</p>
              </div>
            </div>
            <button
              onClick={() => makeRequest(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-mono font-bold text-emerald-400 bg-emerald-400/5 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/10 transition-all disabled:opacity-50"
            >
              <Play size={12} />
              {mode === "secure" ? "Fetch With Auth (secure)" : "Fetch With Auth Token"}
            </button>
          </div>
        </ModeCard>
      </div>

      {/* Spam simulator */}
      <div className="border border-[#1a1a2e] rounded-xl p-4 bg-[#0d0d15]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-white font-mono">Rate Limit Simulator</p>
            <p className="text-xs text-zinc-500">Fires 6 rapid requests to trigger rate limiting (secure mode)</p>
          </div>
          <StatusBadge secure={mode === "secure"} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={simulateSpam}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-orange-400 bg-orange-400/5 border border-orange-400/20 rounded-lg hover:bg-orange-400/10 transition-all disabled:opacity-50"
          >
            <Zap size={12} />
            Simulate Spam (6 requests)
          </button>
          {spamCount > 0 && (
            <div className="flex items-center gap-1 text-xs font-mono text-zinc-500">
              Request <span className="text-white">{spamCount}</span>/6
            </div>
          )}
        </div>
      </div>

      {/* Request log */}
      {requestLogs.length > 0 && (
        <div>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Request Log</p>
          <div className="space-y-2">
            {requestLogs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  "border rounded-lg p-3 font-mono text-xs transition-all",
                  log.blocked
                    ? "border-red-500/30 bg-red-950/10"
                    : "border-emerald-500/20 bg-emerald-950/5"
                )}
              >
                <div className="flex items-center gap-3 mb-2">
                  {log.blocked ? (
                    <XCircle size={13} className="text-red-400" />
                  ) : (
                    <CheckCircle size={13} className="text-emerald-400" />
                  )}
                  <span className={log.blocked ? "text-red-400" : "text-emerald-400"}>
                    HTTP {log.status}
                  </span>
                  <span className="text-zinc-600">{log.time}ms</span>
                  <span className={clsx(
                    "ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                    log.blocked
                      ? "text-red-400 bg-red-400/10"
                      : "text-emerald-400 bg-emerald-400/10"
                  )}>
                    {log.blocked ? (log.status === 401 ? "Unauthorized" : "Rate Limited") : "Success"}
                  </span>
                </div>
                <pre className="text-zinc-500 text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(log.response, null, 2).slice(0, 300)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <InfoPanel
        what="API endpoints expose server resources. Without authentication and rate limiting, any user — or automated bot — can freely access, scrape, or abuse them."
        why="Unauthenticated APIs can expose sensitive data (PII, financial info) to anyone. Without rate limiting, attackers can brute-force credentials or overwhelm your server with requests (DoS)."
        fix="Require a valid auth token (Bearer JWT) for all protected endpoints. Implement rate limiting per IP or user (e.g., express-rate-limit, Redis sliding window). Strip sensitive fields (SSN, salary) from API responses."
        realWorld="In 2021, LinkedIn scraped 700M user records through an exposed API. Facebook leaked 533M records. APIs are consistently the #1 attack surface in modern web apps."
      />

      <LogsPanel module="api-security" />
    </div>
  );
}
