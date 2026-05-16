import {
  getHighestSeverity,
  type IngestedSecurityEvent,
  type SecurityEventSeverity,
} from "./eventIngestion";

export type SecurityEventAlertMode = "audit-only" | "webhook";

export interface SecurityEventAlertPolicy {
  mode: SecurityEventAlertMode;
  minSeverity: SecurityEventSeverity;
  webhookConfigured: boolean;
  timeoutMs: number;
}

export interface SecurityEventAlertResult {
  triggered: boolean;
  delivered: boolean;
  mode: SecurityEventAlertMode;
  severity: SecurityEventSeverity;
  status?: number;
  error?: string;
}

type EnvLike = Record<string, string | undefined>;

const SEVERITY_RANK: Record<SecurityEventSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function isSecurityEventSeverity(value: string | undefined): value is SecurityEventSeverity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function readTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2_500;
  return Math.min(Math.max(Math.floor(parsed), 500), 10_000);
}

export function getSecurityEventAlertPolicy(
  env: EnvLike = process.env
): SecurityEventAlertPolicy {
  const webhookUrl = env.FRONTGUARD_ALERT_WEBHOOK_URL?.trim();
  const minSeverity = isSecurityEventSeverity(env.FRONTGUARD_ALERT_MIN_SEVERITY)
    ? env.FRONTGUARD_ALERT_MIN_SEVERITY
    : "critical";

  return {
    mode: webhookUrl ? "webhook" : "audit-only",
    minSeverity,
    webhookConfigured: Boolean(webhookUrl),
    timeoutMs: readTimeoutMs(env.FRONTGUARD_ALERT_TIMEOUT_MS),
  };
}

export function shouldAlertForSeverity(
  severity: SecurityEventSeverity,
  policy = getSecurityEventAlertPolicy()
): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[policy.minSeverity];
}

function buildAlertPayload(events: readonly IngestedSecurityEvent[]) {
  const severity = getHighestSeverity(events);
  const orgIds = [...new Set(events.map((event) => event.orgId))];
  const projectIds = [...new Set(events.map((event) => event.projectId))];
  const appIds = [...new Set(events.map((event) => event.appId))];

  return {
    type: "frontguard.security_event_alert",
    triggeredAt: new Date().toISOString(),
    severity,
    eventCount: events.length,
    orgIds,
    projectIds,
    appIds,
    events: events.slice(0, 10).map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      orgId: event.orgId,
      projectId: event.projectId,
      appId: event.appId,
      url: event.url,
      receivedAt: event.receivedAt,
      requestId: event.requestId,
      details: event.details,
    })),
  };
}

export async function dispatchSecurityEventAlert(
  events: readonly IngestedSecurityEvent[],
  env: EnvLike = process.env
): Promise<SecurityEventAlertResult> {
  const severity = getHighestSeverity(events);
  const policy = getSecurityEventAlertPolicy(env);

  if (!shouldAlertForSeverity(severity, policy)) {
    return {
      triggered: false,
      delivered: false,
      mode: policy.mode,
      severity,
    };
  }

  const webhookUrl = env.FRONTGUARD_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      triggered: true,
      delivered: false,
      mode: "audit-only",
      severity,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), policy.timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.FRONTGUARD_ALERT_WEBHOOK_TOKEN?.trim()
          ? { authorization: `Bearer ${env.FRONTGUARD_ALERT_WEBHOOK_TOKEN.trim()}` }
          : {}),
      },
      body: JSON.stringify(buildAlertPayload(events)),
      signal: controller.signal,
      cache: "no-store",
    });

    return {
      triggered: true,
      delivered: response.ok,
      mode: "webhook",
      severity,
      status: response.status,
      ...(response.ok ? {} : { error: `Webhook returned HTTP ${response.status}` }),
    };
  } catch (error) {
    return {
      triggered: true,
      delivered: false,
      mode: "webhook",
      severity,
      error: error instanceof Error ? error.message : "Alert webhook failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}
