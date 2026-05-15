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

export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: number;
  url: string;
  details: Record<string, unknown>;
}

export interface FrontGuardEventEnvelope {
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
  apps: number;
  latestReceivedAt: string | null;
  bySeverity: Record<SecurityEventSeverity, number>;
  byType: Record<SecurityEventType, number>;
}

export interface SecurityEventFilters {
  appId?: string;
  severity?: SecurityEventSeverity;
  type?: SecurityEventType;
  limit?: number;
}

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

const MAX_EVENTS_PER_ENVELOPE = 25;
const MAX_STORED_EVENTS = 500;
const MAX_DETAIL_KEYS = 20;
const MAX_ARRAY_VALUES = 10;
const MAX_DETAIL_DEPTH = 2;

const eventStore: IngestedSecurityEvent[] = [];

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

export function validateSecurityEventEnvelope(
  input: unknown
): ValidationResult<FrontGuardEventEnvelope> {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }

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
  for (const optional of [release, sessionId, userId]) {
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
      appId: appId.value,
      environment,
      ...(release.value && { release: release.value }),
      ...(sessionId.value && { sessionId: sessionId.value }),
      ...(userId.value && { userId: userId.value }),
      events: events.filter((event): event is SecurityEvent => event !== null),
    },
  };
}

export function ingestSecurityEventEnvelope(
  envelope: FrontGuardEventEnvelope,
  context: EventIngestionContext
): IngestedSecurityEvent[] {
  const receivedAt = new Date().toISOString();
  const ingested = envelope.events.map((event) => ({
    ...event,
    id: crypto.randomUUID(),
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

  eventStore.unshift(...ingested);
  if (eventStore.length > MAX_STORED_EVENTS) eventStore.length = MAX_STORED_EVENTS;

  return ingested;
}

export function getSecurityEvents(filters: SecurityEventFilters = {}): IngestedSecurityEvent[] {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  return eventStore
    .filter((event) => !filters.appId || event.appId === filters.appId)
    .filter((event) => !filters.severity || event.severity === filters.severity)
    .filter((event) => !filters.type || event.type === filters.type)
    .slice(0, limit);
}

export function getSecurityEventSummary(
  events: readonly IngestedSecurityEvent[] = eventStore
): SecurityEventSummary {
  const appIds = new Set<string>();
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
    bySeverity[event.severity]++;
    byType[event.type]++;
  }

  return {
    total: events.length,
    apps: appIds.size,
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

export function clearSecurityEvents(): void {
  eventStore.length = 0;
}
