"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, CheckCircle, XCircle, Info,
  Lock, Globe, Zap, Server, Eye, Smartphone, FileText
} from "lucide-react";
import clsx from "clsx";
import Link from "next/link";

interface Check {
  id: string;
  label: string;
  description: string;
  status: "active" | "warning" | "info";
  detail: string;
  category: string;
}

const SECURITY_CHECKS: Check[] = [
  // Headers
  {
    id: "csp", category: "Headers", status: "active",
    label: "Content-Security-Policy",
    description: "Restricts which scripts, styles, and resources can load.",
    detail: "Nonce-based CSP generated per-request by proxy. Blocks inline scripts without nonce. Prevents XSS script injection even if attacker bypasses sanitization.",
  },
  {
    id: "hsts", category: "Headers", status: "active",
    label: "Strict-Transport-Security",
    description: "Forces HTTPS for 2 years, including subdomains.",
    detail: "max-age=63072000; includeSubDomains; preload — browsers will never connect over HTTP. Prevents SSL-stripping attacks.",
  },
  {
    id: "xframe", category: "Headers", status: "active",
    label: "X-Frame-Options: DENY",
    description: "Prevents the app from being embedded in iframes.",
    detail: "Blocks clickjacking attacks where attackers overlay a transparent iframe over a legitimate page to hijack clicks.",
  },
  {
    id: "xcto", category: "Headers", status: "active",
    label: "X-Content-Type-Options: nosniff",
    description: "Stops browsers from guessing file types.",
    detail: "Prevents MIME-type confusion attacks where a browser executes a file as a different type than intended (e.g. treating JSON as HTML).",
  },
  {
    id: "coop", category: "Headers", status: "active",
    label: "Cross-Origin-Opener-Policy",
    description: "Isolates browsing context from cross-origin windows.",
    detail: "same-origin — prevents Spectre-class attacks where a malicious site opens a new window to your app and reads memory across origins.",
  },
  {
    id: "corp", category: "Headers", status: "active",
    label: "Cross-Origin-Resource-Policy",
    description: "Blocks cross-origin resource embedding.",
    detail: "same-origin — prevents other sites from loading your images, scripts, or data via <img src> or fetch().",
  },
  {
    id: "referrer", category: "Headers", status: "active",
    label: "Referrer-Policy",
    description: "Controls how much URL info is sent in Referer headers.",
    detail: "strict-origin-when-cross-origin — only sends the origin (not path/query) to cross-origin requests. Prevents leaking sensitive URL parameters.",
  },
  {
    id: "permissions", category: "Headers", status: "active",
    label: "Permissions-Policy",
    description: "Disables browser APIs the app doesn't use.",
    detail: "camera=(), microphone=(), geolocation=(), payment=(), usb=() — reduces attack surface by disabling APIs attackers could abuse via XSS.",
  },
  // Rate limiting
  {
    id: "ratelimit-global", category: "Rate Limiting", status: "active",
    label: "Global Rate Limit",
    description: "120 requests per 60 seconds per IP across all routes.",
    detail: "Enforced in proxy.ts before any route handler runs. Returns 429 with Retry-After header. Prevents DoS and automated scraping.",
  },
  {
    id: "ratelimit-api", category: "Rate Limiting", status: "active",
    label: "API Rate Limit",
    description: "30 requests per 60 seconds per IP on /api/* routes.",
    detail: "Stricter limit on API endpoints. Separate counter from global limit. Prevents brute-force on auth and data endpoints.",
  },
  {
    id: "ratelimit-login", category: "Rate Limiting", status: "active",
    label: "Login Brute-Force Lockout",
    description: "5 failed attempts triggers a 5-minute IP lockout.",
    detail: "Tracked in /api/auth per-IP. After 5 failures the IP is locked for 300 seconds with a clear error. Prevents password spraying.",
  },
  // Input security
  {
    id: "sanitize", category: "Input Security", status: "active",
    label: "Server-Side Input Sanitization",
    description: "All API inputs stripped, escaped, and size-limited.",
    detail: "stripHTML(), escapeHTML(), stripControlChars() applied to every string. Max-length enforced. Body size capped at 10KB. Null bytes removed.",
  },
  {
    id: "validation", category: "Input Security", status: "active",
    label: "Input Format Validation",
    description: "Username, password, and action fields validated by regex.",
    detail: "isValidUsername() requires 3-30 alphanumeric chars. isValidPassword() requires 8-128 chars. Invalid formats rejected before DB lookup.",
  },
  {
    id: "threatdetect", category: "Input Security", status: "active",
    label: "Injection Threat Detection",
    description: "SQL, NoSQL, and path traversal patterns blocked.",
    detail: "checkInputThreats() runs on every API input. Detects SELECT/UNION/DROP, $where/$ne, and ../ patterns. Matching requests are rejected and audit-logged.",
  },
  {
    id: "bodysize", category: "Input Security", status: "active",
    label: "Request Body Size Limit",
    description: "JSON bodies capped at 10KB, login bodies at 1KB.",
    detail: "safeParseBody() checks Content-Length header and actual text length. Prevents large-payload attacks and memory exhaustion.",
  },
  {
    id: "urlscan", category: "Input Security", status: "active",
    label: "URL Injection Scanning",
    description: "Proxy blocks malicious patterns in request paths.",
    detail: "Detects <script, javascript:, ../,UNION SELECT, /etc/passwd and more in the decoded URL path. Returns 400 immediately.",
  },
  // Audit
  {
    id: "auditlog", category: "Audit Log", status: "active",
    label: "Server-Side Audit Log",
    description: "Every security event is logged with IP, UA, and request ID.",
    detail: "Captures: login success/failure, token validation, API auth failures, rate limits, RBAC decisions, input threats, CSP violations. Severity-tagged.",
  },
  {
    id: "csp-report", category: "Audit Log", status: "active",
    label: "CSP Violation Reporting",
    description: "Browser reports blocked script injections to /api/csp-report.",
    detail: "When the browser blocks a script due to CSP, it POSTs a violation report here. Logged as security.csp_violation — potential XSS attempt indicator.",
  },
  {
    id: "requestid", category: "Audit Log", status: "active",
    label: "Request ID Tracing",
    description: "Every response has an X-Request-Id header for log correlation.",
    detail: "UUID v4 generated in proxy.ts. Passed to all audit events. Enables tracing a specific request through all log entries.",
  },
  // PWA / transport
  {
    id: "pwa", category: "Transport & PWA", status: "active",
    label: "Progressive Web App",
    description: "Installable on iOS and Android from the browser.",
    detail: "manifest.json + service worker + offline page. Add to Home Screen works on Chrome/Safari. No app store required.",
  },
  {
    id: "sw-cache", category: "Transport & PWA", status: "active",
    label: "Service Worker Cache Strategy",
    description: "Static assets cached, API routes always network-first.",
    detail: "API routes bypass cache entirely. Static assets use cache-first. Pages use stale-while-revalidate. Offline fallback served for failed navigations.",
  },
  {
    id: "fingerprint", category: "Transport & PWA", status: "active",
    label: "Server Fingerprinting Removed",
    description: "X-Powered-By and Server headers stripped from all responses.",
    detail: "Attackers cannot identify your framework or version from response headers. Removes first step of targeted vulnerability scanning.",
  },
  {
    id: "bot-block", category: "Transport & PWA", status: "active",
    label: "Scanner/Bot Blocking",
    description: "Known security scanner user-agents blocked at proxy.",
    detail: "sqlmap, nikto, nmap, masscan, zgrab, scrapy and others return 403. First-line defense against automated vulnerability scanning.",
  },
  // Warnings
  {
    id: "auth-real", category: "Production Gaps", status: "warning",
    label: "Real Auth Not Implemented",
    description: "Credentials are hardcoded for demo purposes.",
    detail: "For production: use bcrypt/argon2 for password hashing, a real database for user storage, and a proper JWT library (jose) with a secret key from environment variables.",
  },
  {
    id: "ratelimit-mem", category: "Production Gaps", status: "warning",
    label: "Rate Limits Are In-Memory",
    description: "Rate limit counters reset on server restart / new instance.",
    detail: "For production with multiple instances: use Redis or Upstash for distributed rate limiting. Recommended: @upstash/ratelimit + @upstash/redis.",
  },
  {
    id: "audit-mem", category: "Production Gaps", status: "warning",
    label: "Audit Log Is In-Memory",
    description: "Audit events are lost on server restart.",
    detail: "For production: pipe audit events to Postgres, Datadog, Logtail, or Sentry. Use writeAuditEvent() as the single insertion point — just change the sink.",
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Headers":           Lock,
  "Rate Limiting":     Zap,
  "Input Security":    Eye,
  "Audit Log":         FileText,
  "Transport & PWA":   Smartphone,
  "Production Gaps":   ShieldAlert,
};

const STATUS_STYLES = {
  active:  { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  warning: { icon: ShieldAlert,  color: "text-orange-400",  bg: "bg-orange-400/10",  border: "border-orange-400/20" },
  info:    { icon: Info,         color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/20"   },
};

export default function SecurityStatusPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter]     = useState<string>("All");

  const categories  = ["All", ...Array.from(new Set(SECURITY_CHECKS.map((c) => c.category)))];
  const filtered    = filter === "All" ? SECURITY_CHECKS : SECURITY_CHECKS.filter((c) => c.category === filter);

  const active   = SECURITY_CHECKS.filter((c) => c.status === "active").length;
  const warnings = SECURITY_CHECKS.filter((c) => c.status === "warning").length;

  const [requestId, setRequestId] = useState<string>("");
  useEffect(() => {
    // Show the current request ID as a demo of tracing
    fetch("/api/logs", { headers: { "x-security-mode": "secure", Authorization: "Bearer demo" } })
      .then((r) => setRequestId(r.headers.get("x-request-id") ?? ""))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white font-mono tracking-tight mb-1">
          Security Status
        </h1>
        <p className="text-zinc-500 text-sm">
          Every protection layer active on this app — not just the demos.
        </p>
      </div>

      {/* Score card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-emerald-500/20 bg-emerald-950/10 rounded-xl p-5 text-center">
          <div className="text-3xl font-black text-emerald-400 font-mono">{active}</div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">Controls Active</div>
        </div>
        <div className="border border-orange-500/20 bg-orange-950/10 rounded-xl p-5 text-center">
          <div className="text-3xl font-black text-orange-400 font-mono">{warnings}</div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">Production Gaps</div>
        </div>
        <div className="border border-blue-500/20 bg-blue-950/10 rounded-xl p-5 text-center">
          <div className="text-3xl font-black text-blue-400 font-mono">
            {Math.round((active / SECURITY_CHECKS.length) * 100)}%
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-1">Security Score</div>
        </div>
      </div>

      {/* Live request ID demo */}
      {requestId && (
        <div className="border border-zinc-800 bg-[#0d0d18] rounded-xl px-4 py-3 flex items-center gap-3">
          <Server size={13} className="text-zinc-600 shrink-0" />
          <div className="text-xs font-mono">
            <span className="text-zinc-600">Last request traced: </span>
            <span className="text-zinc-300">{requestId}</span>
          </div>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">X-Request-Id header</span>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat] ?? Globe;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all",
                filter === cat
                  ? "bg-white/10 text-white border-zinc-600"
                  : "text-zinc-600 border-zinc-800 hover:border-zinc-600 hover:text-zinc-400"
              )}
            >
              <Icon size={11} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Checks list */}
      <div className="space-y-2">
        {filtered.map((check) => {
          const { icon: StatusIcon, color, bg, border } = STATUS_STYLES[check.status];
          const CatIcon = CATEGORY_ICONS[check.category] ?? Globe;
          const isOpen = expanded === check.id;

          return (
            <div
              key={check.id}
              className={clsx(
                "border rounded-xl overflow-hidden transition-all",
                isOpen ? border : "border-[#1a1a2e] hover:border-[#2a2a3e]"
              )}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : check.id)}
                className={clsx(
                  "w-full flex items-center gap-4 px-5 py-3.5 text-left transition-all",
                  isOpen ? bg : "bg-[#0d0d18] hover:bg-[#111120]"
                )}
              >
                <StatusIcon size={15} className={clsx(color, "shrink-0")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white font-mono">{check.label}</span>
                    <span className="text-[10px] font-mono text-zinc-600 flex items-center gap-1">
                      <CatIcon size={9} /> {check.category}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{check.description}</p>
                </div>
                <span className={clsx(
                  "text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border shrink-0",
                  bg, border, color
                )}>
                  {check.status === "active" ? "✓ active" : check.status === "warning" ? "⚠ gap" : "info"}
                </span>
              </button>

              {isOpen && (
                <div className={clsx("px-5 py-4 border-t text-xs font-mono leading-relaxed text-zinc-400", border, bg)}>
                  {check.detail}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Production upgrade path */}
      <div className="border border-orange-500/20 bg-orange-950/5 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-orange-400" />
          <span className="text-sm font-bold text-white font-mono">Production Upgrade Path</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
          {[
            { label: "Auth", current: "Hardcoded users", prod: "bcrypt + Postgres + jose JWT" },
            { label: "Rate limits", current: "In-memory Map",  prod: "@upstash/ratelimit + Redis" },
            { label: "Audit log", current: "console + Array", prod: "Postgres / Datadog / Logtail" },
          ].map(({ label, current, prod }) => (
            <div key={label} className="border border-zinc-800 rounded-lg p-3 space-y-2 bg-black/20">
              <p className="text-zinc-400 font-bold">{label}</p>
              <p className="text-zinc-600">Now: {current}</p>
              <p className="text-emerald-400">Prod: {prod}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Back link */}
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors">
        ← Back to dashboard
      </Link>
    </div>
  );
}
