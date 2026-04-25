import { NextRequest, NextResponse } from "next/server";
import { getAuditLog, buildEventContext, writeAuditEvent } from "@/lib/security/auditLog";
import { decodeMockToken, hasPermission } from "@/lib/security/utils";

/**
 * Admin-only audit log viewer endpoint.
 * Only accessible with an admin-role token.
 */
export async function GET(req: NextRequest) {
  const ctx = buildEventContext(req);
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const decoded = decodeMockToken(token);

  if (!decoded || typeof decoded.role !== "string") {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  if (!hasPermission(decoded.role, "manage")) {
    writeAuditEvent({ type: "rbac.access_denied", ...ctx, severity: "medium",
      userId: String(decoded.sub), role: decoded.role,
      detail: { action: "view_audit_log" } });
    return NextResponse.json({ error: "Forbidden: admin only" }, { status: 403 });
  }

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 200);
  return NextResponse.json({ ok: true, events: getAuditLog(limit), count: limit });
}
