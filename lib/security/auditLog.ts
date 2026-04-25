/**
 * lib/security/auditLog.ts
 *
 * Server-side audit logging for all security-relevant events.
 * In production: pipe to a real logging service (Datadog, Sentry, Logtail, etc.)
 *
 * This module is SERVER-ONLY — never import from client components.
 */

export type AuditEventType =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.token.invalid"
  | "api.unauthorized"
  | "api.rate_limited"
  | "api.forbidden"
  | "input.threat_detected"
  | "input.validation_failure"
  | "admin.action"
  | "security.csp_violation"
  | "security.scan_detected"
  | "rbac.access_denied"
  | "rbac.access_granted";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: string;          // ISO 8601
  ip: string;
  userAgent: string;
  requestId: string;
  path: string;
  userId?: string;
  role?: string;
  detail?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
}

// In-memory store (resets on cold start)
// Production: replace with append to Postgres, Redis stream, or external log service
const auditLog: AuditEvent[] = [];
const MAX_ENTRIES = 1000; // cap memory usage

export function writeAuditEvent(
  event: Omit<AuditEvent, "id" | "timestamp">
): AuditEvent {
  const entry: AuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  auditLog.unshift(entry);
  if (auditLog.length > MAX_ENTRIES) auditLog.length = MAX_ENTRIES;

  // Console output with severity-based formatting
  const prefix = {
    low:      "[ audit ]",
    medium:   "[ audit ⚠ ]",
    high:     "[ audit 🔶 ]",
    critical: "[ audit 🚨 ]",
  }[entry.severity];

  console.log(
    `${prefix} ${entry.timestamp} | ${entry.type} | ip=${entry.ip} | path=${entry.path}${
      entry.userId ? ` | user=${entry.userId}` : ""
    }${entry.detail ? ` | ${JSON.stringify(entry.detail)}` : ""}`
  );

  return entry;
}

export function getAuditLog(limit = 50): AuditEvent[] {
  return auditLog.slice(0, limit);
}

export function getAuditLogByType(type: AuditEventType, limit = 20): AuditEvent[] {
  return auditLog.filter((e) => e.type === type).slice(0, limit);
}

export function getAuditLogByIP(ip: string, limit = 20): AuditEvent[] {
  return auditLog.filter((e) => e.ip === ip).slice(0, limit);
}

// Helper: build event context from a Next.js request
export function buildEventContext(req: Request): {
  ip: string;
  userAgent: string;
  requestId: string;
  path: string;
} {
  const headers = req.headers;
  return {
    ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? headers.get("x-real-ip")
      ?? "unknown",
    userAgent: headers.get("user-agent") ?? "unknown",
    requestId: headers.get("x-request-id") ?? crypto.randomUUID(),
    path: new URL(req.url).pathname,
  };
}
