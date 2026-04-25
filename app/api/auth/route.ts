import { NextRequest, NextResponse } from "next/server";
import { generateMockToken } from "@/lib/security/utils";
import { sanitizeString, isValidUsername, isValidPassword, safeParseBody, checkInputThreats } from "@/lib/security/sanitize";
import { writeAuditEvent, buildEventContext } from "@/lib/security/auditLog";

const USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "alice", password: "password", role: "user" },
  { username: "guest", password: "guest",    role: "guest" },
];

// Per-IP brute-force tracking
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 5 * 60 * 1000;

function checkBruteForce(ip: string): { allowed: boolean; lockedFor?: number } {
  const entry = loginAttempts.get(ip);
  const now = Date.now();
  if (entry && now < entry.lockedUntil) {
    return { allowed: false, lockedFor: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry && now >= entry.lockedUntil) loginAttempts.delete(ip);
  return { allowed: true };
}

function recordFailedAttempt(ip: string) {
  const entry = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCKOUT_MS;
  loginAttempts.set(ip, entry);
}

function clearFailedAttempts(ip: string) {
  loginAttempts.delete(ip);
}

export async function POST(req: NextRequest) {
  const ctx = buildEventContext(req);
  const mode = req.headers.get("x-security-mode") ?? "attack";

  const bruteCheck = checkBruteForce(ctx.ip);
  if (!bruteCheck.allowed) {
    writeAuditEvent({ type: "auth.login.failure", ...ctx, severity: "high",
      detail: { reason: "locked", lockedFor: bruteCheck.lockedFor } });
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${bruteCheck.lockedFor}s.` },
      { status: 429 }
    );
  }

  const parsed = await safeParseBody(req, 1_000);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const body = parsed.data as Record<string, unknown>;
  const rawUsername = sanitizeString(body.username, 50);
  const rawPassword = sanitizeString(body.password, 128);

  if (!rawUsername || !rawPassword)
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });

  const usernameThreat = checkInputThreats(rawUsername);
  if (!usernameThreat.safe) {
    writeAuditEvent({ type: "input.threat_detected", ...ctx, severity: "critical",
      detail: { field: "username", reason: usernameThreat.reason } });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (!isValidUsername(rawUsername) || !isValidPassword(rawPassword))
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const user = USERS.find((u) => u.username === rawUsername && u.password === rawPassword);

  if (!user) {
    recordFailedAttempt(ctx.ip);
    writeAuditEvent({ type: "auth.login.failure", ...ctx, severity: "medium",
      detail: { username: rawUsername } });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  clearFailedAttempts(ctx.ip);
  writeAuditEvent({ type: "auth.login.success", ...ctx, userId: user.username,
    role: user.role, severity: "low" });

  const token = generateMockToken(user.username, user.role);

  if (mode === "secure") {
    const res = NextResponse.json({ ok: true, user: { username: user.username, role: user.role } });
    res.cookies.set("fg_token", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600,
      path: "/",
    });
    return res;
  }

  return NextResponse.json({ ok: true, token, user: { username: user.username, role: user.role } });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
