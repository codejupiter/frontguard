import { sanitizeString } from "./sanitize";

export const SECURITY_EVENT_TYPES = [
  "dom.script-injected",
  "dom.iframe-injected",
  "dom.suspicious-attribute",
] as const;

export const SECURITY_EVENT_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const FRONTGUARD_ENVIRONMENTS = [
  "production",
  "preview",
  "development",
] as const;

export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];
export type SecurityEventSeverity = (typeof SECURITY_EVENT_SEVERITIES)[number];
export type FrontGuardEnvironment = (typeof FRONTGUARD_ENVIRONMENTS)[number];
export type SecurityEventStorageMode = "memory" | "redis";

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: number;
  url: string;
  details: Record<string, unknown>;
}

export interface FrontGuardEventEnvelope {
  orgId?: string;
  projectId?: string;
  appId: string;
  environment: FrontGuardEnvironment;
  release?: string;
  sessionId?: string;
  userId?: string;
  events: SecurityEvent[];
}

export interface EventIngestionContext {
  requestId: string;
  sourceIp: string;
  userAgent: string;
}

export interface IngestedSecurityEvent extends SecurityEvent {
  id: string;
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
  userAgent: string;
}

export interface SecurityEventSummary {
  total: number;
  orgs: number;
  projects: number;
  apps: number;
  storageMode: SecurityEventStorageMode;
  latestReceivedAt: string | null;
  bySeverity: Record<SecurityEventSeverity, number>;
  byType: Record<SecurityEventType, number>;
}

export interface SecurityEventRetentionPolicy {
  maxStoredEvents: number;
  retentionDays: number | null;
  retentionSeconds: number | null;
}

export interface SecurityEventFilters {
  orgId?: string;
  projectId?: string;
  appId?: string;
  severity?: SecurityEventSeverity;
  type?: SecurityEventType;
  limit?: number;
}

export interface FrontGuardWorkspaceProject {
  projectId: string;
  appId: string;
  name: string;
  environment: FrontGuardEnvironment;
}

export interface FrontGuardWorkspace {
  orgId: string;
  orgName: string;
  projects: FrontGuardWorkspaceProject[];
}

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

type ResolvedWorkspaceMetadata = {
  orgId: string;
  orgName: string;
  projectId: string;
  projectName: string;
};

type RedisConfig = {
  url: string;
  token: string;
  key: string;
};

type EventStorageAdapter = {
  mode: SecurityEventStorageMode;
  save(events: readonly IngestedSecurityEvent[]): Promise<void>;
  list(filters?: SecurityEventFilters): Promise<IngestedSecurityEvent[]>;
  clear(): Promise<void>;
};

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

const MAX_EVENTS_PER_ENVELOPE = 25;
const DEFAULT_MAX_STORED_EVENTS = 500;
const DEFAULT_RETENTION_DAYS = 14;
const MAX_DETAIL_KEYS = 20;
const MAX_ARRAY_VALUES = 10;
const MAX_DETAIL_DEPTH = 2;
const DEFAULT_EVENT_STORE_KEY = "frontguard:events:v2";

const inMemoryEventStore: IngestedSecurityEvent[] = [];

export const FRONTGUARD_WORKSPACES = [
  {
    orgId: "frontguard-labs",
    orgName: "FrontGuard Labs",
    projects: [
      {
        projectId: "agent-demo",
        appId: "frontguard-agent-demo",
        name: "Agent Runtime Demo",
        environment: "production",
      },
      {
        projectId: "playground",
        appId: "frontguard-playground",
        name: "Security Playground",
        environment: "preview",
      },
      {
        projectId: "smoke-tests",
        appId: "frontguard-smoke",
        name: "Release Smoke Tests",
        environment: "preview",
      },
      {
        projectId: "live-checks",
        appId: "frontguard-agent-live-check",
        name: "Live Agent Checks",
        environment: "production",
      },
    ],
  },
  {
    orgId: "portfolio-demo",
    orgName: "Portfolio Demo Co",
    projects: [
      {
        projectId: "checkout-web",
        appId: "checkout-web",
        name: "Checkout Web",
        environment: "production",
      },
      {
        projectId: "docs-portal",
        appId: "docs-portal",
        name: "Docs Portal",
        environment: "preview",
      },
    ],
  },
] satisfies FrontGuardWorkspace[];

const severityRank: Record<SecurityEventSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSecurityEventType(value: string): value is SecurityEventType {
  return SECURITY_EVENT_TYPES.includes(value as SecurityEventType);
}

function isSecurityEventSeverity(value: string): value is SecurityEventSeverity {
  return SECURITY_EVENT_SEVERITIES.includes(value as SecurityEventSeverity);
}

function isFrontGuardEnvironment(value: string): value is FrontGuardEnvironment {
  return FRONTGUARD_ENVIRONMENTS.includes(value as FrontGuardEnvironment);
}

function sanitizeIdentifier(value: unknown, maxLength: number): string {
  return sanitizeString(value, maxLength).replace(/[^a-zA-Z0-9_.:@/-]/g, "");
}

function validateIdentifier(
  value: unknown,
  field: string,
  maxLength: number,
  required = false
): { value?: string; error?: string } {
  if (value === undefined || value === null || value === "") {
    return required ? { error: `${field} is required` } : {};
  }

  const sanitized = sanitizeIdentifier(value, maxLength);
  if (!sanitized || sanitized.length < 2) {
    return { error: `${field} must be a safe identifier` };
  }

  return { value: sanitized };
}

function validateEventUrl(value: unknown): { value?: string; error?: string } {
  if (typeof value !== "string") return { error: "event.url must be a string" };
  if (value.length > 500) return { error: "event.url is too long" };

  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { error: "event.url must use http or https" };
    }
    return { value: parsed.toString() };
  } catch {
    return { error: "event.url must be a valid URL" };
  }
}

function sanitizeDetailValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return sanitizeString(value, 500);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;

  if (Array.isArray(value)) {
    if (depth >= MAX_DETAIL_DEPTH) return "[truncated]";
    return value
      .slice(0, MAX_ARRAY_VALUES)
      .map((item) => sanitizeDetailValue(item, depth + 1));
  }

  if (isRecord(value)) {
    if (depth >= MAX_DETAIL_DEPTH) return "[truncated]";
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_DETAIL_KEYS)
        .map(([key, nestedValue]) => [
          sanitizeString(key, 80),
          sanitizeDetailValue(nestedValue, depth + 1),
        ])
    );
  }

  return null;
}

function sanitizeDetails(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_DETAIL_KEYS)
      .map(([key, detailValue]) => [
        sanitizeString(key, 80),
        sanitizeDetailValue(detailValue),
      ])
  );
}

function titleizeIdentifier(value: string): string {
  return value
    .replace(/[_:/.-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findWorkspaceProject(appId: string) {
  for (const workspace of FRONTGUARD_WORKSPACES) {
    for (const project of workspace.projects) {
      if (appId === project.appId || appId.startsWith(`${project.appId}-`)) {
        return { workspace, project };
      }
    }
  }

  return null;
}

export function resolveWorkspaceMetadata(
  envelope: Pick<FrontGuardEventEnvelope, "appId" | "orgId" | "projectId">
): ResolvedWorkspaceMetadata {
  const matched = findWorkspaceProject(envelope.appId);
  const orgId = envelope.orgId ?? matched?.workspace.orgId ?? "frontguard-demo";
  const projectId = envelope.projectId ?? matched?.project.projectId ?? envelope.appId;
  const workspace = FRONTGUARD_WORKSPACES.find((item) => item.orgId === orgId);
  const project =
    workspace?.projects.find((item) => item.projectId === projectId) ??
    matched?.project;

  return {
    orgId,
    orgName: workspace?.orgName ?? matched?.workspace.orgName ?? titleizeIdentifier(orgId),
    projectId,
    projectName: project?.name ?? titleizeIdentifier(projectId),
  };
}

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.floor(limit ?? 50), 1), 200);
}

function readNumberEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

export function getSecurityEventRetentionPolicy(
  env: Record<string, string | undefined> = process.env
): SecurityEventRetentionPolicy {
  const maxStoredEvents = readNumberEnv(
    env.FRONTGUARD_EVENT_MAX_EVENTS,
    DEFAULT_MAX_STORED_EVENTS,
    50,
    10_000
  );
  const retentionDays = readNumberEnv(
    env.FRONTGUARD_EVENT_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
    0,
    365
  );

  return {
    maxStoredEvents,
    retentionDays: retentionDays === 0 ? null : retentionDays,
    retentionSeconds: retentionDays === 0 ? null : retentionDays * 24 * 60 * 60,
  };
}

function isWithinRetention(
  event: IngestedSecurityEvent,
  policy: SecurityEventRetentionPolicy,
  now = Date.now()
): boolean {
  if (policy.retentionDays === null) return true;
  const receivedAt = Date.parse(event.receivedAt);
  if (!Number.isFinite(receivedAt)) return false;
  return receivedAt >= now - policy.retentionDays * 24 * 60 * 60 * 1000;
}

function filterSecurityEvents(
  events: readonly IngestedSecurityEvent[],
  filters: SecurityEventFilters = {}
): IngestedSecurityEvent[] {
  const limit = clampLimit(filters.limit);
  const policy = getSecurityEventRetentionPolicy();

  return events
    .filter((event) => isWithinRetention(event, policy))
    .filter((event) => !filters.orgId || event.orgId === filters.orgId)
    .filter((event) => !filters.projectId || event.projectId === filters.projectId)
    .filter((event) => !filters.appId || event.appId === filters.appId)
    .filter((event) => !filters.severity || event.severity === filters.severity)
    .filter((event) => !filters.type || event.type === filters.type)
    .slice(0, limit);
}

function readRedisConfig(): RedisConfig | null {
  const url =
    process.env.FRONTGUARD_REDIS_REST_URL ??
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.FRONTGUARD_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  const key =
    sanitizeIdentifier(
      process.env.FRONTGUARD_EVENT_STORE_KEY ?? DEFAULT_EVENT_STORE_KEY,
      160
    ) || DEFAULT_EVENT_STORE_KEY;

  return {
    url: url.replace(/\/+$/, ""),
    token,
    key,
  };
}

function getMemoryEventStore(): EventStorageAdapter {
  return {
    mode: "memory",
    async save(events) {
      const policy = getSecurityEventRetentionPolicy();
      inMemoryEventStore.unshift(...events);
      const retained = inMemoryEventStore.filter((event) =>
        isWithinRetention(event, policy)
      );
      inMemoryEventStore.splice(0, inMemoryEventStore.length, ...retained);
      if (inMemoryEventStore.length > policy.maxStoredEvents) {
        inMemoryEventStore.length = policy.maxStoredEvents;
      }
    },
    async list(filters) {
      return filterSecurityEvents(inMemoryEventStore, filters);
    },
    async clear() {
      inMemoryEventStore.length = 0;
    },
  };
}

async function redisCommand<T>(
  config: RedisConfig,
  command: readonly unknown[]
): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const payload = (await response.json()) as UpstashResponse<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error ?? `Redis REST command failed with ${response.status}`);
  }

  return payload.result as T;
}

async function redisPipeline(
  config: RedisConfig,
  commands: readonly (readonly unknown[])[]
): Promise<void> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    const error = isRecord(payload) && typeof payload.error === "string"
      ? payload.error
      : undefined;
    throw new Error(error ?? `Redis REST pipeline failed with ${response.status}`);
  }

  const error = payload.find(
    (item): item is UpstashResponse<unknown> =>
      isRecord(item) && typeof item.error === "string"
  )?.error;

  if (!response.ok || error) {
    throw new Error(error ?? `Redis REST pipeline failed with ${response.status}`);
  }
}

function parseStoredEvent(value: string): IngestedSecurityEvent | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed.id !== "string" || typeof parsed.appId !== "string") {
      return null;
    }

    return parsed as unknown as IngestedSecurityEvent;
  } catch {
    return null;
  }
}

function getRedisEventStore(config: RedisConfig): EventStorageAdapter {
  return {
    mode: "redis",
    async save(events) {
      if (events.length === 0) return;
      const policy = getSecurityEventRetentionPolicy();

      await redisPipeline(config, [
        ...events.map((event) => ["LPUSH", config.key, JSON.stringify(event)]),
        ["LTRIM", config.key, 0, policy.maxStoredEvents - 1],
        ...(policy.retentionSeconds
          ? [["EXPIRE", config.key, policy.retentionSeconds]]
          : []),
      ]);
    },
    async list(filters) {
      const policy = getSecurityEventRetentionPolicy();
      const stored = await redisCommand<string[]>(config, [
        "LRANGE",
        config.key,
        0,
        policy.maxStoredEvents - 1,
      ]);

      return filterSecurityEvents(
        stored.map(parseStoredEvent).filter((event): event is IngestedSecurityEvent => event !== null),
        filters
      );
    },
    async clear() {
      await redisCommand<number>(config, ["DEL", config.key]);
    },
  };
}

function getEventStore(): EventStorageAdapter {
  const redisConfig = readRedisConfig();
  if (redisConfig) return getRedisEventStore(redisConfig);
  return getMemoryEventStore();
}

export function getSecurityEventStorageMode(): SecurityEventStorageMode {
  return readRedisConfig() ? "redis" : "memory";
}

export function validateSecurityEventEnvelope(
  input: unknown
): ValidationResult<FrontGuardEventEnvelope> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }

  const orgId = validateIdentifier(input.orgId, "orgId", 80);
  const projectId = validateIdentifier(input.projectId, "projectId", 80);
  const appId = validateIdentifier(input.appId, "appId", 80, true);
  if (appId.error) errors.push(appId.error);

  const environmentValue = input.environment;
  const environment =
    typeof environmentValue === "string" && isFrontGuardEnvironment(environmentValue)
      ? environmentValue
      : undefined;
  if (!environment) {
    errors.push("environment must be production, preview, or development");
  }

  const release = validateIdentifier(input.release, "release", 80);
  const sessionId = validateIdentifier(input.sessionId, "sessionId", 120);
  const userId = validateIdentifier(input.userId, "userId", 120);
  for (const optional of [orgId, projectId, release, sessionId, userId]) {
    if (optional.error) errors.push(optional.error);
  }

  if (!Array.isArray(input.events)) {
    errors.push("events must be an array");
  } else if (input.events.length === 0) {
    errors.push("events must include at least one event");
  } else if (input.events.length > MAX_EVENTS_PER_ENVELOPE) {
    errors.push(`events cannot include more than ${MAX_EVENTS_PER_ENVELOPE} items`);
  }

  const events = Array.isArray(input.events)
    ? input.events.slice(0, MAX_EVENTS_PER_ENVELOPE).map((eventInput, index) => {
        if (!isRecord(eventInput)) {
          errors.push(`events[${index}] must be an object`);
          return null;
        }

        const typeValue = eventInput.type;
        const type =
          typeof typeValue === "string" && isSecurityEventType(typeValue)
            ? typeValue
            : undefined;
        if (!type) errors.push(`events[${index}].type is invalid`);

        const severityValue = eventInput.severity;
        const severity =
          typeof severityValue === "string" && isSecurityEventSeverity(severityValue)
            ? severityValue
            : undefined;
        if (!severity) errors.push(`events[${index}].severity is invalid`);

        const timestamp =
          typeof eventInput.timestamp === "number" && Number.isFinite(eventInput.timestamp)
            ? eventInput.timestamp
            : undefined;
        if (!timestamp) errors.push(`events[${index}].timestamp must be a number`);

        const url = validateEventUrl(eventInput.url);
        if (url.error) errors.push(`events[${index}].${url.error}`);

        if (!type || !severity || !timestamp || !url.value) return null;

        return {
          type,
          severity,
          timestamp,
          url: url.value,
          details: sanitizeDetails(eventInput.details),
        };
      })
    : [];

  if (errors.length > 0 || !appId.value || !environment) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      ...(orgId.value && { orgId: orgId.value }),
      ...(projectId.value && { projectId: projectId.value }),
      appId: appId.value,
      environment,
      ...(release.value && { release: release.value }),
      ...(sessionId.value && { sessionId: sessionId.value }),
      ...(userId.value && { userId: userId.value }),
      events: events.filter((event): event is SecurityEvent => event !== null),
    },
  };
}

export async function ingestSecurityEventEnvelope(
  envelope: FrontGuardEventEnvelope,
  context: EventIngestionContext
): Promise<IngestedSecurityEvent[]> {
  const receivedAt = new Date().toISOString();
  const workspace = resolveWorkspaceMetadata(envelope);
  const ingested = envelope.events.map((event) => ({
    ...event,
    id: crypto.randomUUID(),
    orgId: workspace.orgId,
    orgName: workspace.orgName,
    projectId: workspace.projectId,
    projectName: workspace.projectName,
    appId: envelope.appId,
    environment: envelope.environment,
    release: envelope.release,
    sessionId: envelope.sessionId,
    userId: envelope.userId,
    receivedAt,
    requestId: context.requestId,
    sourceIp: context.sourceIp,
    userAgent: sanitizeString(context.userAgent, 200),
  }));

  await getEventStore().save(ingested);

  return ingested;
}

export async function getSecurityEvents(
  filters: SecurityEventFilters = {}
): Promise<IngestedSecurityEvent[]> {
  return getEventStore().list(filters);
}

export function getSecurityEventSummary(
  events: readonly IngestedSecurityEvent[],
  storageMode: SecurityEventStorageMode = getSecurityEventStorageMode()
): SecurityEventSummary {
  const appIds = new Set<string>();
  const orgIds = new Set<string>();
  const projectIds = new Set<string>();
  const bySeverity: Record<SecurityEventSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const byType: Record<SecurityEventType, number> = {
    "dom.script-injected": 0,
    "dom.iframe-injected": 0,
    "dom.suspicious-attribute": 0,
  };

  for (const event of events) {
    appIds.add(event.appId);
    orgIds.add(event.orgId);
    projectIds.add(`${event.orgId}:${event.projectId}`);
    bySeverity[event.severity]++;
    byType[event.type]++;
  }

  return {
    total: events.length,
    orgs: orgIds.size,
    projects: projectIds.size,
    apps: appIds.size,
    storageMode,
    latestReceivedAt: events[0]?.receivedAt ?? null,
    bySeverity,
    byType,
  };
}

export function getHighestSeverity(
  events: readonly SecurityEvent[]
): SecurityEventSeverity {
  return events.reduce<SecurityEventSeverity>(
    (highest, event) =>
      severityRank[event.severity] > severityRank[highest]
        ? event.severity
        : highest,
    "low"
  );
}

export async function clearSecurityEvents(): Promise<void> {
  await getEventStore().clear();
}
