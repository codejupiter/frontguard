import { NextRequest, NextResponse } from "next/server";
import { buildEventContext, writeAuditEvent } from "@/lib/security/auditLog";
import { safeParseBody, sanitizeString } from "@/lib/security/sanitize";
import {
  clearSecurityEvents,
  FRONTGUARD_WORKSPACES,
  getHighestSeverity,
  getSecurityEvents,
  getSecurityEventSummary,
  getSecurityEventStorageMode,
  ingestSecurityEventEnvelope,
  SECURITY_EVENT_SEVERITIES,
  SECURITY_EVENT_TYPES,
  type SecurityEventSeverity,
  type SecurityEventType,
  validateSecurityEventEnvelope,
} from "@/lib/security/eventIngestion";

export const dynamic = "force-dynamic";

const DEFAULT_ALLOWED_EVENT_ORIGINS = [
  "https://frontguard-agent.vercel.app",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
];

function configuredAllowedOrigins(req: NextRequest): Set<string> {
  const configured = process.env.FRONTGUARD_EVENT_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

  return new Set([
    req.nextUrl.origin,
    ...DEFAULT_ALLOWED_EVENT_ORIGINS,
    ...configured,
  ]);
}

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function allowedCorsOrigin(req: NextRequest): string | null | undefined {
  const origin = req.headers.get("origin");
  if (!origin) return undefined;

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return null;
  if (isLocalDevOrigin(normalizedOrigin)) return normalizedOrigin;

  return configuredAllowedOrigins(req).has(normalizedOrigin)
    ? normalizedOrigin
    : null;
}

function responseHeaders(req: NextRequest, init?: ResponseInit): Headers {
  const headers = new Headers(init?.headers);
  const corsOrigin = allowedCorsOrigin(req);

  headers.set("cache-control", "no-store");
  headers.set("vary", "Origin");

  if (corsOrigin) {
    headers.set("access-control-allow-origin", corsOrigin);
    headers.set("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
    headers.set("access-control-max-age", "600");
  }

  return headers;
}

function json(req: NextRequest, data: unknown, init?: ResponseInit) {
  const headers = responseHeaders(req, init);
  return NextResponse.json(data, { ...init, headers });
}

function forbiddenOriginResponse(req: NextRequest): NextResponse | null {
  if (allowedCorsOrigin(req) !== null) return null;

  return json(
    req,
    { ok: false, error: "Origin is not allowed to submit security events" },
    { status: 403 }
  );
}

function readLimit(req: NextRequest): number {
  const raw = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  if (!Number.isFinite(raw)) return 50;
  return Math.min(Math.max(Math.floor(raw), 1), 200);
}

function readSeverity(req: NextRequest): SecurityEventSeverity | undefined {
  const value = req.nextUrl.searchParams.get("severity");
  return SECURITY_EVENT_SEVERITIES.includes(value as SecurityEventSeverity)
    ? (value as SecurityEventSeverity)
    : undefined;
}

function readType(req: NextRequest): SecurityEventType | undefined {
  const value = req.nextUrl.searchParams.get("type");
  return SECURITY_EVENT_TYPES.includes(value as SecurityEventType)
    ? (value as SecurityEventType)
    : undefined;
}

function readIdentifier(req: NextRequest, key: string): string | undefined {
  return sanitizeString(req.nextUrl.searchParams.get(key) ?? "", 80) || undefined;
}

export async function GET(req: NextRequest) {
  const storageMode = getSecurityEventStorageMode();

  try {
    const events = await getSecurityEvents({
      orgId: readIdentifier(req, "orgId"),
      projectId: readIdentifier(req, "projectId"),
      appId: readIdentifier(req, "appId"),
      severity: readSeverity(req),
      type: readType(req),
      limit: readLimit(req),
    });

    return json(req, {
      ok: true,
      events,
      summary: getSecurityEventSummary(events, storageMode),
      storage: storageMode,
      workspaces: FRONTGUARD_WORKSPACES,
    });
  } catch {
    return json(
      req,
      {
        ok: false,
        error: "Security event storage is unavailable",
        storage: storageMode,
      },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  const forbidden = forbiddenOriginResponse(req);
  if (forbidden) return forbidden;

  const ctx = buildEventContext(req);
  const body = await safeParseBody(req, 20_000);

  if (!body.ok) {
    writeAuditEvent({
      type: "input.validation_failure",
      ...ctx,
      severity: "medium",
      detail: { endpoint: "/api/security-events", reason: body.error },
    });

    return json(req, { ok: false, error: body.error }, { status: 400 });
  }

  const validated = validateSecurityEventEnvelope(body.data);

  if (!validated.ok) {
    writeAuditEvent({
      type: "input.validation_failure",
      ...ctx,
      severity: "high",
      detail: {
        endpoint: "/api/security-events",
        errors: validated.errors.slice(0, 5),
      },
    });

    return json(req, { ok: false, errors: validated.errors }, { status: 400 });
  }

  const storageMode = getSecurityEventStorageMode();
  let ingested: Awaited<ReturnType<typeof ingestSecurityEventEnvelope>>;

  try {
    ingested = await ingestSecurityEventEnvelope(validated.data, {
      requestId: ctx.requestId,
      sourceIp: ctx.ip,
      userAgent: ctx.userAgent,
    });
  } catch {
    writeAuditEvent({
      type: "security.storage_error",
      ...ctx,
      severity: "high",
      detail: {
        endpoint: "/api/security-events",
        storageMode,
      },
    });

    return json(
      req,
      { ok: false, error: "Security event storage is unavailable", storage: storageMode },
      { status: 503 }
    );
  }

  const severity = getHighestSeverity(ingested);

  writeAuditEvent({
    type: "security.agent_event",
    ...ctx,
    severity,
    detail: {
      endpoint: "/api/security-events",
      appId: validated.data.appId,
      environment: validated.data.environment,
      count: ingested.length,
      highestSeverity: severity,
    },
  });

  let summaryEvents = ingested;
  try {
    summaryEvents = await getSecurityEvents({ limit: 200 });
  } catch {
    summaryEvents = ingested;
  }

  return json(
    req,
    {
      ok: true,
      accepted: ingested.length,
      events: ingested,
      summary: getSecurityEventSummary(summaryEvents, storageMode),
      storage: storageMode,
      workspaces: FRONTGUARD_WORKSPACES,
    },
    { status: 202 }
  );
}

export async function DELETE(req: NextRequest) {
  const forbidden = forbiddenOriginResponse(req);
  if (forbidden) return forbidden;

  const ctx = buildEventContext(req);
  const storageMode = getSecurityEventStorageMode();

  try {
    await clearSecurityEvents();
  } catch {
    return json(
      req,
      { ok: false, error: "Security event storage is unavailable", storage: storageMode },
      { status: 503 }
    );
  }

  writeAuditEvent({
    type: "admin.action",
    ...ctx,
    severity: "low",
    detail: { action: "clear_security_event_demo_store" },
  });

  return json(req, {
    ok: true,
    events: [],
    summary: getSecurityEventSummary([], storageMode),
    storage: storageMode,
    workspaces: FRONTGUARD_WORKSPACES,
  });
}

export async function OPTIONS(req: NextRequest) {
  const forbidden = forbiddenOriginResponse(req);
  if (forbidden) return forbidden;

  return new NextResponse(null, {
    status: 204,
    headers: responseHeaders(req),
  });
}
