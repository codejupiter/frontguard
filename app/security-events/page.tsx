"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  Boxes,
  Building2,
  Database,
  Filter,
  Radio,
  RefreshCw,
  Send,
  Server,
  Trash2,
} from "lucide-react";

type SecurityEventType =
  | "dom.script-injected"
  | "dom.iframe-injected"
  | "dom.suspicious-attribute";
type SecurityEventSeverity = "low" | "medium" | "high" | "critical";
type FrontGuardEnvironment = "production" | "preview" | "development";
type SecurityEventStorageMode = "memory" | "redis";

interface IngestedSecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: number;
  url: string;
  details: Record<string, unknown>;
  orgId: string;
  orgName: string;
  projectId: string;
  projectName: string;
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
  orgs: number;
  projects: number;
  apps: number;
  storageMode: SecurityEventStorageMode;
  latestReceivedAt: string | null;
  bySeverity: Record<SecurityEventSeverity, number>;
  byType: Record<SecurityEventType, number>;
}

interface FrontGuardWorkspaceProject {
  projectId: string;
  appId: string;
  name: string;
  environment: FrontGuardEnvironment;
}

interface FrontGuardWorkspace {
  orgId: string;
  orgName: string;
  projects: FrontGuardWorkspaceProject[];
}

interface EventPolicy {
  maxStoredEvents: number;
  retentionDays: number | null;
  retentionSeconds: number | null;
}

interface EventAuthSummary {
  mode: "open-demo" | "token";
  tokenScopes: string[];
  adminMode: "open-demo" | "token";
}

interface ProjectAccessSummary {
  mode: "open-demo" | "token";
  tokenScopes: { scope: string; role: "viewer" | "triager" | "admin" }[];
}

interface AlertingPolicy {
  mode: "audit-only" | "webhook";
  minSeverity: SecurityEventSeverity;
  webhookConfigured: boolean;
  timeoutMs: number;
}

interface EventsResponse {
  ok: boolean;
  events: IngestedSecurityEvent[];
  summary: EventSummary;
  storage: SecurityEventStorageMode;
  policy: EventPolicy;
  auth: EventAuthSummary;
  access: ProjectAccessSummary;
  alerting: AlertingPolicy;
  workspaces: FrontGuardWorkspace[];
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
  orgs: 0,
  projects: 0,
  apps: 0,
  storageMode: "memory",
  latestReceivedAt: null,
  bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
  byType: {
    "dom.script-injected": 0,
    "dom.iframe-injected": 0,
    "dom.suspicious-attribute": 0,
  },
};

const emptyPolicy: EventPolicy = {
  maxStoredEvents: 500,
  retentionDays: 14,
  retentionSeconds: 14 * 24 * 60 * 60,
};

const emptyAuth: EventAuthSummary = {
  mode: "open-demo",
  tokenScopes: [],
  adminMode: "open-demo",
};

const emptyAccess: ProjectAccessSummary = {
  mode: "open-demo",
  tokenScopes: [],
};

const emptyAlerting: AlertingPolicy = {
  mode: "audit-only",
  minSeverity: "critical",
  webhookConfigured: false,
  timeoutMs: 2500,
};

interface WorkspaceFilters {
  orgId: string;
  projectId: string;
  appId: string;
}

const emptyWorkspaceFilters: WorkspaceFilters = {
  orgId: "",
  projectId: "",
  appId: "",
};

const workspaceFilterControls = [
  { key: "orgId", label: "Org ID", placeholder: "frontguard-labs" },
  { key: "projectId", label: "Project ID", placeholder: "agent-demo" },
  { key: "appId", label: "App ID", placeholder: "frontguard-agent-demo" },
] as const satisfies readonly {
  key: keyof WorkspaceFilters;
  label: string;
  placeholder: string;
}[];

function readInitialWorkspaceFilters(): WorkspaceFilters {
  if (typeof window === "undefined") return emptyWorkspaceFilters;

  const params = new URLSearchParams(window.location.search);
  return {
    orgId: params.get("orgId") ?? "",
    projectId: params.get("projectId") ?? "",
    appId: params.get("appId") ?? "",
  };
}

function readInitialAccessToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("frontguard.accessToken") ?? "";
}

function normalizeWorkspaceFilters(filters: WorkspaceFilters): WorkspaceFilters {
  return {
    orgId: filters.orgId.trim(),
    projectId: filters.projectId.trim(),
    appId: filters.appId.trim(),
  };
}

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

function retentionLabel(policy: EventPolicy): string {
  return policy.retentionDays === null
    ? `${policy.maxStoredEvents} events`
    : `${policy.retentionDays}d / ${policy.maxStoredEvents} events`;
}

async function fetchSecurityEvents(
  severityFilter: SecurityEventSeverity | "all",
  filters: WorkspaceFilters,
  accessToken = ""
): Promise<EventsResponse> {
  const params = new URLSearchParams({ limit: "50" });
  if (severityFilter !== "all") params.set("severity", severityFilter);
  if (filters.orgId) params.set("orgId", filters.orgId);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.appId) params.set("appId", filters.appId);

  const headers = new Headers();
  if (accessToken.trim()) {
    headers.set("x-frontguard-access-token", accessToken.trim());
  }

  const response = await fetch(`/api/security-events?${params.toString()}`, {
    cache: "no-store",
    headers,
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
  const [draftFilters, setDraftFilters] = useState(readInitialWorkspaceFilters);
  const [queryFilters, setQueryFilters] = useState(readInitialWorkspaceFilters);
  const [workspaces, setWorkspaces] = useState<FrontGuardWorkspace[]>([]);
  const [policy, setPolicy] = useState<EventPolicy>(emptyPolicy);
  const [auth, setAuth] = useState<EventAuthSummary>(emptyAuth);
  const [access, setAccess] = useState<ProjectAccessSummary>(emptyAccess);
  const [alerting, setAlerting] = useState<AlertingPolicy>(emptyAlerting);
  const [accessToken, setAccessToken] = useState(readInitialAccessToken);

  async function loadEvents(
    filters = queryFilters,
    severity = severityFilter
  ) {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchSecurityEvents(
        severity,
        normalizeWorkspaceFilters(filters),
        accessToken
      );
      setEvents(data.events);
      setSummary(data.summary);
      setWorkspaces(data.workspaces ?? []);
      setPolicy(data.policy ?? emptyPolicy);
      setAuth(data.auth ?? emptyAuth);
      setAccess(data.access ?? emptyAccess);
      setAlerting(data.alerting ?? emptyAlerting);
    } catch {
      setError("Security event stream is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const filters = normalizeWorkspaceFilters(queryFilters);

    fetchSecurityEvents(severityFilter, filters, accessToken)
      .then((data) => {
        if (cancelled) return;
        setEvents(data.events);
        setSummary(data.summary);
        setWorkspaces(data.workspaces ?? []);
        setPolicy(data.policy ?? emptyPolicy);
        setAuth(data.auth ?? emptyAuth);
        setAccess(data.access ?? emptyAccess);
        setAlerting(data.alerting ?? emptyAlerting);
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
  }, [accessToken, queryFilters, severityFilter]);

  const highPriorityCount = summary.bySeverity.critical + summary.bySeverity.high;

  function applyWorkspaceFilters() {
    setQueryFilters(normalizeWorkspaceFilters(draftFilters));
  }

  function resetWorkspaceFilters() {
    setDraftFilters({ ...emptyWorkspaceFilters });
    setQueryFilters({ ...emptyWorkspaceFilters });
    setSeverityFilter("all");
  }

  function updateAccessToken(value: string) {
    setAccessToken(value);
    sessionStorage.setItem("frontguard.accessToken", value);
  }

  async function sendSampleEvent() {
    setPosting(true);
    setError(null);
    const draft = normalizeWorkspaceFilters(draftFilters);
    const sampleFilters = {
      orgId: draft.orgId || "frontguard-labs",
      projectId: draft.projectId || "agent-demo",
      appId: draft.appId || "frontguard-agent-demo",
    };

    const sampleEnvelope = {
      orgId: sampleFilters.orgId,
      projectId: sampleFilters.projectId,
      appId: sampleFilters.appId,
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
      setDraftFilters(sampleFilters);
      setQueryFilters(sampleFilters);
      await loadEvents(sampleFilters);
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
    <div data-testid="security-events-dashboard" className="w-full max-w-6xl mx-auto space-y-5">
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
            this app validates tenant-scoped envelopes, persists recent events, and presents a security review queue.
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
            onClick={() => void loadEvents()}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: "Events", value: summary.total, icon: Activity, color: "text-white", testId: "security-events-total" },
          { label: "High Priority", value: highPriorityCount, icon: AlertTriangle, color: "text-red-300" },
          { label: "Orgs", value: summary.orgs, icon: Building2, color: "text-cyan-300" },
          { label: "Projects", value: summary.projects, icon: Boxes, color: "text-blue-300" },
          {
            label: "Storage",
            value: summary.storageMode === "redis" ? "Redis" : "Memory",
            icon: Server,
            color: summary.storageMode === "redis" ? "text-emerald-300" : "text-zinc-300",
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
          <div className="border border-[#1a1a2e] bg-[#0d0d18] rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <Filter size={12} />
                Workspace filters
              </div>
              <div className="text-[10px] font-mono text-zinc-600">
                {summary.apps} app{summary.apps === 1 ? "" : "s"} in scope
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
              {workspaceFilterControls.map(({ key, label, placeholder }) => (
                <label key={key} className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-700 font-mono mb-1.5">
                    {label}
                  </span>
                  <input
                    value={draftFilters[key]}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-xs font-mono text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-emerald-500/50"
                  />
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <button
                data-testid="security-events-apply-filters"
                onClick={applyWorkspaceFilters}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-mono font-bold text-white bg-white/10 border border-zinc-700 rounded-lg hover:border-zinc-500 transition-all"
              >
                Apply filters
              </button>
              <button
                onClick={resetWorkspaceFilters}
                className="inline-flex items-center gap-2 px-3 py-2 text-xs font-mono text-zinc-600 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:text-zinc-300 transition-all"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
              <Filter size={12} />
              Severity
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
                      <p className="max-w-32 truncate">{event.requestId}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="rounded-lg border border-black/20 bg-black/20 p-2 min-w-0">
                      <p className="text-zinc-700 uppercase mb-1">Org</p>
                      <p className="text-zinc-300 break-all">{event.orgName}</p>
                      <p className="text-zinc-600 break-all">{event.orgId}</p>
                    </div>
                    <div className="rounded-lg border border-black/20 bg-black/20 p-2 min-w-0">
                      <p className="text-zinc-700 uppercase mb-1">Project</p>
                      <p className="text-zinc-300 break-all">{event.projectName}</p>
                      <p className="text-zinc-600 break-all">{event.projectId}</p>
                    </div>
                    <div className="rounded-lg border border-black/20 bg-black/20 p-2 min-w-0">
                      <p className="text-zinc-700 uppercase mb-1">App</p>
                      <p className="text-zinc-400 break-all">{event.appId}</p>
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
            <p className="text-sm font-bold text-white font-mono mb-3">Workspace Model</p>
            <div className="space-y-3">
              {workspaces.length > 0 ? (
                workspaces.slice(0, 2).map((workspace) => (
                  <div key={workspace.orgId} className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-zinc-300 font-mono">{workspace.orgName}</p>
                      <span className="text-[10px] text-zinc-600 font-mono">{workspace.orgId}</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {workspace.projects.slice(0, 3).map((project) => (
                        <div key={project.projectId} className="flex items-center justify-between gap-2 text-[10px] font-mono">
                          <span className="text-zinc-500 truncate">{project.name}</span>
                          <span className="text-zinc-700 shrink-0">{project.projectId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-zinc-600 font-mono">Loading workspace registry...</p>
              )}
            </div>
          </div>

          <div className="border border-[#1a1a2e] bg-[#0d0d18] rounded-xl p-4">
            <p className="text-sm font-bold text-white font-mono mb-2">Event Contract</p>
            <pre className="overflow-x-auto text-[10px] leading-relaxed text-zinc-500 bg-black/30 border border-zinc-800 rounded-lg p-3">
{`{
  "orgId": "frontguard-labs",
  "projectId": "agent-demo",
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

          <div className="border border-cyan-500/20 bg-cyan-950/5 rounded-xl p-4">
            <p className="text-sm font-bold text-white font-mono mb-3">Access & Retention</p>
            <div className="space-y-2 text-xs font-mono">
              <label className="block pb-2">
                <span className="block text-[10px] uppercase tracking-widest text-zinc-700 mb-1.5">
                  Access Token
                </span>
                <input
                  value={accessToken}
                  onChange={(event) => updateAccessToken(event.target.value)}
                  placeholder="optional viewer token"
                  type="password"
                  className="w-full rounded-lg border border-zinc-800 bg-black/20 px-3 py-2 text-xs font-mono text-zinc-300 outline-none transition-colors placeholder:text-zinc-700 focus:border-cyan-500/50"
                />
              </label>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Reads</span>
                <span className={access.mode === "token" ? "text-emerald-300" : "text-yellow-300"}>
                  {access.mode === "token"
                    ? `${access.tokenScopes.length} scoped`
                    : "demo open"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Writes</span>
                <span className={auth.mode === "token" ? "text-emerald-300" : "text-yellow-300"}>
                  {auth.mode === "token" ? "token scoped" : "demo open"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Admin</span>
                <span className={auth.adminMode === "token" ? "text-emerald-300" : "text-yellow-300"}>
                  {auth.adminMode === "token" ? "token required" : "demo open"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Retention</span>
                <span className="text-cyan-200">{retentionLabel(policy)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Alerts</span>
                <span className={alerting.mode === "webhook" ? "text-emerald-300" : "text-yellow-300"}>
                  {alerting.mode === "webhook"
                    ? `${alerting.minSeverity}+ webhook`
                    : `${alerting.minSeverity}+ audit`}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-blue-500/20 bg-blue-950/5 rounded-xl p-4">
            <p className="text-sm font-bold text-white font-mono mb-2">Production Path</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Redis REST activates when storage credentials are present. Project reads, write scopes,
              retention, and critical alerts are environment-driven.
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
