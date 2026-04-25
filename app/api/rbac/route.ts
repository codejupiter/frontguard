import { NextRequest, NextResponse } from "next/server";
import { decodeMockToken, hasPermission } from "@/lib/security/utils";
import { writeAuditEvent, buildEventContext } from "@/lib/security/auditLog";
import { sanitizeString, checkInputThreats } from "@/lib/security/sanitize";

const VALID_ACTIONS = ["read", "write", "delete", "manage"] as const;
type Action = typeof VALID_ACTIONS[number];

export async function GET(req: NextRequest) {
  const ctx = buildEventContext(req);
  const mode = req.headers.get("x-security-mode") ?? "attack";

  // Validate and sanitize action param
  const rawAction = sanitizeString(req.nextUrl.searchParams.get("action") ?? "", 20);
  const threat = checkInputThreats(rawAction);
  if (!threat.safe) {
    writeAuditEvent({ type: "input.threat_detected", ...ctx, severity: "high",
      detail: { param: "action", reason: threat.reason } });
    return NextResponse.json({ error: "Invalid action parameter" }, { status: 400 });
  }

  const action = VALID_ACTIONS.includes(rawAction as Action) ? rawAction as Action : null;
  if (!action) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }

  if (mode === "attack") {
    // Demo: trust client-provided role — intentionally insecure
    const clientRole = sanitizeString(req.headers.get("x-client-role") ?? "guest", 20);
    writeAuditEvent({ type: "rbac.access_granted", ...ctx, severity: "low",
      role: clientRole, detail: { action, mode: "attack", warning: "Client-provided role, no verification" } });
    return NextResponse.json({
      ok: true,
      message: `Action '${action}' allowed for role '${clientRole}' (frontend-only — no server validation)`,
      warning: "This trusts a client-provided header. Never do this in production.",
    });
  }

  // Secure: validate JWT server-side
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    writeAuditEvent({ type: "api.unauthorized", ...ctx, severity: "medium",
      detail: { endpoint: "/api/rbac", action } });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const decoded = decodeMockToken(token);

  if (!decoded || typeof decoded.role !== "string") {
    writeAuditEvent({ type: "auth.token.invalid", ...ctx, severity: "high",
      detail: { endpoint: "/api/rbac" } });
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  const role = decoded.role;
  const allowed = hasPermission(role, action);

  if (!allowed) {
    writeAuditEvent({ type: "rbac.access_denied", ...ctx, severity: "medium",
      userId: String(decoded.sub), role,
      detail: { action, reason: `role '${role}' cannot perform '${action}'` } });
    return NextResponse.json(
      { error: `Forbidden: role '${role}' cannot perform '${action}'` },
      { status: 403 }
    );
  }

  writeAuditEvent({ type: "rbac.access_granted", ...ctx, severity: "low",
    userId: String(decoded.sub), role, detail: { action } });

  return NextResponse.json({
    ok: true,
    message: `Action '${action}' permitted for role '${role}'`,
    user: { role },
  });
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
