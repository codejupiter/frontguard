"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  Database,
  Filter,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";

type SecurityEventType =
  | "dom.script-injected"
  | "dom.iframe-injected"
  | "dom.suspicious-attribute";
type SecurityEventSeverity = "low" | "medium" | "high" | "critical";
type FrontGuardEnvironment = "production" | "preview" | "development";

interface IngestedSecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: number;
  url: string;
  details: Record<string, unknown>;
  appId: string;
  environment: FrontGuardEnvironment;
  release?: string;
  sessionId?: string;
  userId?: string;
  receivedAt: string;
  requestId: string;
  sourceIp: string;
}

interface EventSummary {
  total: number;
  apps: number;
  latestReceivedAt: string | null;
  bySeverity: Record<SecurityEventSeverity, number>;
  byType: Record<SecurityEventType, number>;
}

interface EventsResponse {
  ok: boolean;
  events: IngestedSecurityEvent[];
  summary: EventSummary;
}

const severityStyles: Record<
  SecurityEventSeverity,
  { label: string; badge: string; dot: string; panel: string; text: string }
> = {
  critical: {
    label: "Critical",
    badge: "text-red-300 bg-red-500/10 border-red-500/30",
    dot: "bg-red-400",
    panel: "border-red-500/30 bg-red-950/10",
    text: "text-red-300",
  },
  high: {
    label: "High",
    badge: "text-orange-300 bg-orange-500/10 border-orange-500/30",
    dot: "bg-orange-400",
    panel: "border-orange-500/30 bg-orange-950/10",
    text: "text-orange-300",
  },
  medium: {
    label: "Medium",
    badge: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
    dot: "bg-yellow-400",
    panel: "border-yellow-500/30 bg-yellow-950/10",
    text: "text-yellow-300",
  },
  low: {
    label: "Low",
    badge: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-400",
    panel: "border-emerald-500/30 bg-emerald-950/10",
    text: "text-emerald-300",
  },
};

const eventTypeLabels: Record<SecurityEventType, string> = {
  "dom.script-injected": "Script injection",
  "dom.iframe-injected": "Iframe injection",
  "dom.suspicious-attribute": "Suspicious attribute",
};

const emptySummary: EventSummary = {
  total: 0,
  apps: 0,
  latestReceivedAt: null,
  bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  byType: {
    "dom.script-injected": 0,
    "dom.iframe-injected": 0,
    "dom.suspicious-attribute": 0,
  },
};

function formatTime(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function detailPreview(details: Record<string, unknown>): string {
  const src = details.src;
  const attribute = details.attribute;
  const srcdoc = details.srcdoc;

  if (typeof src === "string" && src) return src;
  if (typeof attribute === "string" && attribute) return `attribute: ${attribute}`;
  if (typeof srcdoc === "string" && srcdoc) return "inline iframe srcdoc";
  return JSON.stringify(details).slice(0, 120);
}

async function fetchSecurityEvents(
  severityFilter: SecurityEventSeverity | "all",
  appIdFilter: string
): Promise<EventsResponse> {
  const params = new URLSearchParams({ limit: "50" });
  if (severityFilter !== "all") params.set("severity", severityFilter);
  if (appIdFilter) params.set("appId", appIdFilter);

  const response = await fetch(`/api/security-events?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return (await response.json()) as EventsResponse;
}

export default function SecurityEventsPage() {
  const [events, setEvents] = useState<IngestedSecurityEvent[]>([]);
  const [summary, setSummary] = useState<EventSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SecurityEventSeverity | "all">("all");
  const [appIdFilter] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("appId") ?? "";
  });

  async function loadEvents() {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchSecurityEvents(severityFilter, appIdFilter);
      setEvents(data.events);
      setSummary(data.summary);
    } catch {
      setError("Security event stream is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchSecurityEvents(severityFilter, appIdFilter)
      .then((data) => {
        if (cancelled) return;
        setEvents(data.events);
        setSummary(data.summary);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("Security event stream is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appIdFilter, severityFilter]);

  const highPriorityCount = summary.bySeverity.critical + summary.bySeverity.high;

  async function sendSampleEvent() {
    setPosting(true);
    setError(null);

    const sampleEnvelope = {
      appId: appIdFilter || "frontguard-playground",
      environment: "preview",
      release: "suite-v2-demo",
      sessionId: `demo-${Date.now().toString(36)}`,
      events: [
        {
          type: "dom.script-injected",
          severity: "critical",
          timestamp: Date.now(),
          url: window.location.href,
          details: {
            src: "https://evil.example/skimmer.js",
            allowlisted: false,
            async: true,
            defer: false,
          },
        },
      ],
    };

    try {
      const response = await fetch("/api/security-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sampleEnvelope),
      });
      if (response.status !== 202) throw new Error(`HTTP ${response.status}`);
      await loadEvents();
    } catch {
      setError("Sample event could not be ingested.");
    } finally {
      setPosting(false);
    }
  }

  async function clearDemoEvents() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/security-events", { method: "DELETE" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await loadEvents();
    } catch {
      setError("Demo event store could not be cleared.");
      setLoading(false);
    }
  }

  return (
    <div data-testid="security-events-dashboard" className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <Radio size={14} className="text-emerald-400" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400">
              FrontGuard Suite v2
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Security Event Triage
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-2xl mt-2">
            Prototype ingestion for FrontGuard Agent events. The browser package emits runtime findings,
            this app validates the envelope, stores recent events, and presents a security review queue.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            data-testid="event-ingest-button"
            onClick={sendSampleEvent}
            disabled={posting}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
          >
            <Send size={12} />
            {posting ? "Sending..." : "Send Sample Event"}
          </button>
          <button
            onClick={loadEvents}
            disabled={loading}
            className="inline-flex items-center justify-center w-10 h-10 text-zinc-500 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50 transition-all"
            aria-label="Refresh events"
          >
            <RefreshCw size={14} className={clsx(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-950/10 rounded-lg px-4 py-3 text-sm text-red-200 font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: "Events", value: summary.total, icon: Activity, color: "text-white", testId: "security-events-total" },
          { label: "High Priority", value: highPriorityCount, icon: AlertTriangle, color: "text-red-300" },
          { label: "Apps", value: summary.apps, icon: Database, color: "text-blue-300" },
          {
            label: "Latest",
            value: summary.latestReceivedAt ? formatTime(summary.latestReceivedAt) : "none",
            icon: ShieldCheck,
            color: "text-emerald-300",
          },
        ].map(({ label, value, icon: Icon, color, testId }) => (
          <div key={label} className="border border-[#1a1a2e] bg-[#0d0d18] rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">{label}</span>
              <Icon size={14} className="text-zinc-600" />
            </div>
            <div data-testid={testId} className={clsx("mt-3 text-2xl font-black font-mono tabular-nums", color)}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <Filter size={12} />
              Filter by severity
            </div>
            <button
              data-testid="security-events-clear"
              onClick={clearDemoEvents}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-mono text-zinc-600 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:text-zinc-300 transition-all"
            >
              <Trash2 size={12} />
              Clear demo stream
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "critical", "high", "medium", "low"] as const).map((severity) => (
              <button
                key={severity}
                onClick={() => setSeverityFilter(severity)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-mono border transition-all capitalize",
                  severityFilter === severity
                    ? "bg-white/10 text-white border-zinc-600"
                    : "text-zinc-600 border-zinc-800 hover:border-zinc-600 hover:text-zinc-400"
                )}
              >
                {severity}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {!loading && events.length === 0 && (
              <div
                data-testid="security-events-empty"
                className="border border-[#1a1a2e] bg-[#0d0d18] rounded-xl p-8 text-center"
              >
                <Database size={22} className="mx-auto text-zinc-700 mb-3" />
                <p className="text-sm font-bold text-white font-mono">No events in the demo stream</p>
                <p className="text-xs text-zinc-600 mt-1">Send a sample event to exercise the ingestion path.</p>
              </div>
            )}

            {events.map((event) => {
              const severity = severityStyles[event.severity];
              return (
                <article
                  key={event.id}
                  data-testid="security-event-row"
                  className={clsx("rounded-xl border p-4 transition-all", severity.panel)}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx("inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase", severity.badge)}>
                          <span className={clsx("w-1.5 h-1.5 rounded-full", severity.dot)} />
                          {severity.label}
                        </span>
                        <span className="text-sm font-bold text-white font-mono">
                          {eventTypeLabels[event.type]}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500 break-all">
                        {detailPreview(event.details)}
                      </p>
                    </div>
                    <div className="text-right text-[10px] font-mono text-zinc-600 shrink-0">
                      <p>{formatTime(event.receivedAt)}</p>
                      <p>{event.environment}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2 text-[10px] font-mono">
                    <div className="rounded-lg border border-black/20 bg-black/20 p-2 min-w-0">
                      <p className="text-zinc-700 uppercase mb-1">App</p>
                      <p className="text-zinc-400 break-all">{event.appId}</p>
                    </div>
                    <div className="rounded-lg border border-black/20 bg-black/20 p-2 min-w-0">
                      <p className="text-zinc-700 uppercase mb-1">Request</p>
                      <p className="text-zinc-400 break-all">{event.requestId}</p>
                    </div>
                    <div className="rounded-lg border border-black/20 bg-black/20 p-2 min-w-0">
                      <p className="text-zinc-700 uppercase mb-1">Page URL</p>
                      <p className="text-zinc-400 break-all">{event.url}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="border border-[#1a1a2e] bg-[#0d0d18] rounded-xl p-4">
            <p className="text-sm font-bold text-white font-mono mb-2">Event Contract</p>
            <pre className="overflow-x-auto text-[10px] leading-relaxed text-zinc-500 bg-black/30 border border-zinc-800 rounded-lg p-3">
{`{
  "appId": "frontguard-playground",
  "environment": "preview",
  "events": [{
    "type": "dom.script-injected",
    "severity": "critical",
    "timestamp": 1778882400000,
    "url": "https://app.example.com",
    "details": { "src": "https://..." }
  }]
}`}
            </pre>
          </div>

          <div className="border border-emerald-500/20 bg-emerald-950/5 rounded-xl p-4">
            <p className="text-sm font-bold text-white font-mono mb-3">Severity Mix</p>
            <div className="space-y-2">
              {(["critical", "high", "medium", "low"] as const).map((severity) => (
                <div key={severity} className="flex items-center justify-between text-xs font-mono">
                  <span className="capitalize text-zinc-500">{severity}</span>
                  <span className={severityStyles[severity].text}>
                    {summary.bySeverity[severity]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-blue-500/20 bg-blue-950/5 rounded-xl p-4">
            <p className="text-sm font-bold text-white font-mono mb-2">Production Path</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Replace the in-memory demo store with Postgres or an event stream, authenticate
              app writes, add tenant-scoped retention, and alert on critical findings.
            </p>
          </div>
        </aside>
      </div>

      <Link href="/" className="inline-flex items-center gap-2 text-xs font-mono text-zinc-600 hover:text-zinc-400 transition-colors">
        Back to dashboard
      </Link>
    </div>
  );
}
