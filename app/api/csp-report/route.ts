import { NextRequest, NextResponse } from "next/server";
import { writeAuditEvent, buildEventContext } from "@/lib/security/auditLog";

/**
 * CSP Violation Report endpoint
 * Browsers POST here when a CSP directive is violated.
 * Set report-uri or report-to in your CSP header to this endpoint.
 */
export async function POST(req: NextRequest) {
  const ctx = buildEventContext(req);

  try {
    const body = await req.json();
    const report = body?.["csp-report"] ?? body;

    writeAuditEvent({
      type: "security.csp_violation",
      ...ctx,
      severity: "high",
      detail: {
        blockedURI:       report["blocked-uri"],
        violatedDirective:report["violated-directive"],
        originalPolicy:   report["original-policy"]?.slice(0, 200),
        documentURI:      report["document-uri"],
        referrer:         report["referrer"],
      },
    });
  } catch {
    // Malformed report — still 204
  }

  // Always respond 204 — browsers expect no content
  return new NextResponse(null, { status: 204 });
}
