import { NextRequest, NextResponse } from "next/server";
import { buildEventContext, writeAuditEvent } from "@/lib/security/auditLog";
import { safeParseBody, sanitizeString } from "@/lib/security/sanitize";
import {
  clearSecurityEvents,
  getHighestSeverity,
  getSecurityEvents,
  getSecurityEventSummary,
  ingestSecurityEventEnvelope,
  SECURITY_EVENT_SEVERITIES,
  SECURITY_EVENT_TYPES,
  type SecurityEventSeverity,
  type SecurityEventType,
  validateSecurityEventEnvelope,
} from "@/lib/security/eventIngestion";

export const dynamic = "force-dynamic";

function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(data, { ...init, headers });
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

export async function GET(req: NextRequest) {
  const events = getSecurityEvents({
    appId: sanitizeString(req.nextUrl.searchParams.get("appId") ?? "", 80) || undefined,
    severity: readSeverity(req),
    type: readType(req),
    limit: readLimit(req),
  });

  return json({
    ok: true,
    events,
    summary: getSecurityEventSummary(events),
  });
}

export async function POST(req: NextRequest) {
  const ctx = buildEventContext(req);
  const body = await safeParseBody(req, 20_000);

  if (!body.ok) {
    writeAuditEvent({
      type: "input.validation_failure",
      ...ctx,
      severity: "medium",
      detail: { endpoint: "/api/security-events", reason: body.error },
    });

    return json({ ok: false, error: body.error }, { status: 400 });
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

    return json({ ok: false, errors: validated.errors }, { status: 400 });
  }

  const ingested = ingestSecurityEventEnvelope(validated.data, {
    requestId: ctx.requestId,
    sourceIp: ctx.ip,
    userAgent: ctx.userAgent,
  });
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

  return json(
    {
      ok: true,
      accepted: ingested.length,
      events: ingested,
      summary: getSecurityEventSummary(),
    },
    { status: 202 }
  );
}

export async function DELETE(req: NextRequest) {
  const ctx = buildEventContext(req);
  clearSecurityEvents();

  writeAuditEvent({
    type: "admin.action",
    ...ctx,
    severity: "low",
    detail: { action: "clear_security_event_demo_store" },
  });

  return json({
    ok: true,
    events: [],
    summary: getSecurityEventSummary(),
  });
}
