import { NextRequest, NextResponse } from "next/server";
import { decodeMockToken } from "@/lib/security/utils";
import { writeAuditEvent, buildEventContext } from "@/lib/security/auditLog";
import { checkInputThreats, sanitizeString } from "@/lib/security/sanitize";

// Per-IP rate limit for this endpoint specifically
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string, limit = 3, windowMs = 10_000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

const SENSITIVE_DATA = {
  users: [
    { id: 1, name: "Alice Johnson", email: "alice@company.com", salary: 95000, ssn: "123-45-6789" },
    { id: 2, name: "Bob Smith",     email: "bob@company.com",   salary: 82000, ssn: "987-65-4321" },
    { id: 3, name: "Carol White",   email: "carol@company.com", salary: 110000,ssn: "555-12-3456" },
  ],
};

export async function GET(req: NextRequest) {
  const ctx = buildEventContext(req);
  const mode = req.headers.get("x-security-mode") ?? "attack";

  // Check for injection in query params
  const searchParam = sanitizeString(req.nextUrl.searchParams.get("q") ?? "", 100);
  if (searchParam) {
    const threat = checkInputThreats(searchParam);
    if (!threat.safe) {
      writeAuditEvent({ type: "input.threat_detected", ...ctx, severity: "high",
        detail: { param: "q", reason: threat.reason } });
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }
  }

  if (mode === "secure") {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      writeAuditEvent({ type: "api.unauthorized", ...ctx, severity: "medium",
        detail: { endpoint: "/api/logs" } });
      return NextResponse.json({ error: "Unauthorized: missing token" }, { status: 401,
        headers: { "WWW-Authenticate": "Bearer" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = decodeMockToken(token);
    if (!decoded) {
      writeAuditEvent({ type: "auth.token.invalid", ...ctx, severity: "high",
        detail: { endpoint: "/api/logs" } });
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { allowed, remaining } = rateLimit(ctx.ip);
    if (!allowed) {
      writeAuditEvent({ type: "api.rate_limited", ...ctx, severity: "medium",
        detail: { endpoint: "/api/logs", userId: String(decoded.sub) } });
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": "10", "X-RateLimit-Remaining": "0" },
      });
    }

    // Strip sensitive fields — return only safe subset
    const safeData = SENSITIVE_DATA.users.map(({ id, name, email }) => ({ id, name, email }));
    writeAuditEvent({ type: "api.access_granted" as Parameters<typeof writeAuditEvent>[0]["type"],
      ...ctx, severity: "low", userId: String(decoded.sub),
      detail: { endpoint: "/api/logs", records: safeData.length } });

    return NextResponse.json({
      ok: true,
      data: safeData,
      meta: { rateLimit: { remaining }, fieldsStripped: ["ssn", "salary"] },
    });
  }

  // Attack mode — no auth, no rate limit, full PII exposure (demo purposes)
  writeAuditEvent({ type: "api.unauthorized", ...ctx, severity: "high",
    detail: { mode: "attack", endpoint: "/api/logs", note: "Demo: intentionally unprotected" } });

  return NextResponse.json({
    ok: true,
    data: SENSITIVE_DATA.users,
    meta: { note: "No authentication. All fields exposed including SSN and salary." },
  });
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
