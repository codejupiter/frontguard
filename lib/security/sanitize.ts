/**
 * lib/security/sanitize.ts
 *
 * All input sanitization and validation used across API routes.
 * Never trust client input — sanitize everything server-side.
 */

// ─── String sanitization ──────────────────────────────────────────────────────

/** Strip all HTML tags from a string */
export function stripHTML(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/** Escape HTML entities to prevent injection in server-rendered output */
export function escapeHTML(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/** Remove null bytes and control characters */
export function stripControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

/** Truncate to a max length and sanitize */
export function sanitizeString(
  input: unknown,
  maxLength = 500
): string {
  if (typeof input !== "string") return "";
  return stripControlChars(stripHTML(input.trim())).slice(0, maxLength);
}

// ─── Type validators ──────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  // RFC-compliant email check (simplified but solid)
  return /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/.test(email) && email.length <= 320;
}

export function isValidUsername(username: string): boolean {
  // 3-30 chars, alphanumeric + underscore only
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

export function isValidPassword(password: string): boolean {
  // Min 8 chars — in prod: add complexity requirements
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

// ─── JSON body parser with size limit ────────────────────────────────────────

export async function safeParseBody(
  req: Request,
  maxBytes = 10_000
): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > maxBytes) {
    return { ok: false, error: "Request body too large" };
  }

  try {
    const text = await req.text();
    if (text.length > maxBytes) {
      return { ok: false, error: "Request body too large" };
    }
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

// ─── SQL injection pattern detection (for logging / alerting) ────────────────

const SQL_INJECTION_PATTERNS = [
  /(\b)(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)(\b)/i,
  /('|--|;|\/\*|\*\/|xp_|CAST\s*\(|CONVERT\s*\()/i,
  /(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,
];

export function hasSQLInjection(input: string): boolean {
  return SQL_INJECTION_PATTERNS.some((p) => p.test(input));
}

// ─── NoSQL injection pattern detection ───────────────────────────────────────

export function hasNoSQLInjection(input: string): boolean {
  return /(\$where|\$ne|\$gt|\$lt|\$regex|\$exists|\$or|\$and)/.test(input);
}

// ─── Path traversal detection ─────────────────────────────────────────────────

export function hasPathTraversal(input: string): boolean {
  const decoded = decodeURIComponent(input);
  return /(\.\.[/\\]|[/\\]\.\.)/.test(decoded);
}

// ─── Comprehensive input threat check ────────────────────────────────────────

export type ThreatCheckResult =
  | { safe: true }
  | { safe: false; reason: string };

export function checkInputThreats(input: string): ThreatCheckResult {
  if (hasSQLInjection(input))  return { safe: false, reason: "SQL injection pattern detected" };
  if (hasNoSQLInjection(input)) return { safe: false, reason: "NoSQL injection pattern detected" };
  if (hasPathTraversal(input))  return { safe: false, reason: "Path traversal detected" };
  if (/<script[\s>]/i.test(input)) return { safe: false, reason: "Script injection detected" };
  if (/javascript:/i.test(input))  return { safe: false, reason: "JavaScript URI detected" };
  return { safe: true };
}
