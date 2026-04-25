import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

// ─── In-memory rate limiter (per IP, resets on cold start) ───────────────────
// For production with multiple instances, replace with Redis/Upstash
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function globalRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const LIMIT = 120;       // requests
  const WINDOW = 60_000;   // per 60 seconds
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW });
    return { allowed: true, remaining: LIMIT - 1, resetIn: WINDOW };
  }

  if (entry.count >= LIMIT) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: LIMIT - entry.count, resetIn: entry.resetAt - now };
}

// ─── API-specific stricter rate limit ─────────────────────────────────────────
const apiRateLimitStore = new Map<string, { count: number; resetAt: number }>();

function apiRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const LIMIT = 30;
  const WINDOW = 60_000;
  const now = Date.now();
  const entry = apiRateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    apiRateLimitStore.set(ip, { count: 1, resetAt: now + WINDOW });
    return { allowed: true, remaining: LIMIT - 1 };
  }

  if (entry.count >= LIMIT) return { allowed: false, remaining: 0 };
  entry.count++;
  return { allowed: true, remaining: LIMIT - entry.count };
}

// ─── Known bad user agents (bots, scanners) ───────────────────────────────────
const BLOCKED_UA_PATTERNS = [
  /sqlmap/i, /nikto/i, /nmap/i, /masscan/i, /zgrab/i,
  /python-requests\/[0-1]/i, /go-http-client\/1/i,
  /curl\/[0-6]/i, /libwww-perl/i, /scrapy/i,
];

function isBadUserAgent(ua: string | null): boolean {
  if (!ua) return false;
  return BLOCKED_UA_PATTERNS.some((p) => p.test(ua));
}

// ─── CSP nonce generation ─────────────────────────────────────────────────────
function generateNonce(): string {
  // Generates a random base64 nonce for inline script whitelisting
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

// ─── Build Content-Security-Policy header ────────────────────────────────────
// Dev mode needs 'unsafe-eval' for React/Turbopack hot reload & source maps.
// Production is fully strict — eval() is never used in built output.
const IS_DEV = process.env.NODE_ENV !== "production";

function buildCSP(nonce: string): string {
  const scriptSrc = IS_DEV
    ? `'self' 'nonce-${nonce}' 'unsafe-eval'`   // dev: allow eval for Turbopack HMR
    : `'self' 'nonce-${nonce}'`;                  // prod: strict, no eval

  const directives: Record<string, string> = {
    "default-src":     "'self'",
    "script-src":      scriptSrc,
    "style-src":       "'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src":        "'self' https://fonts.gstatic.com",
    "img-src":         "'self' data: blob:",
    "connect-src":     IS_DEV ? "'self' ws: wss:" : "'self'", // dev: allow WS for HMR
    "frame-ancestors": "'none'",
    "base-uri":        "'self'",
    "form-action":     "'self'",
    "object-src":      "'none'",
    "upgrade-insecure-requests": "",
  };

  return Object.entries(directives)
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join("; ");
}

// ─── Proxy (Next.js 16 middleware convention) ─────────────────────────────────
export function proxy(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "127.0.0.1";

  const ua = request.headers.get("user-agent");
  const path = request.nextUrl.pathname;
  const requestId = uuidv4();

  // 1. Block known bad user agents
  if (isBadUserAgent(ua)) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "X-Request-Id": requestId },
    });
  }

  // 2. Global rate limit (all routes)
  const globalLimit = globalRateLimit(ip);
  if (!globalLimit.allowed) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests", retryAfter: Math.ceil(globalLimit.resetIn / 1000) }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(globalLimit.resetIn / 1000)),
          "X-RateLimit-Limit": "120",
          "X-RateLimit-Remaining": "0",
          "X-Request-Id": requestId,
        },
      }
    );
  }

  // 3. Stricter rate limit for API routes
  if (path.startsWith("/api/")) {
    const apiLimit = apiRateLimit(ip);
    if (!apiLimit.allowed) {
      return new NextResponse(
        JSON.stringify({ error: "API rate limit exceeded" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            "X-RateLimit-Limit": "30",
            "X-RateLimit-Remaining": "0",
            "X-Request-Id": requestId,
          },
        }
      );
    }
  }

  // 4. Block suspicious path traversal / injection attempts
  const decodedPath = decodeURIComponent(path);
  const SUSPICIOUS = [
    "../", "..\\", "<script", "javascript:", "data:text/html",
    "vbscript:", "onload=", "onerror=", "eval(",
    "/etc/passwd", "/proc/self", "UNION SELECT", "DROP TABLE",
  ];
  if (SUSPICIOUS.some((s) => decodedPath.toLowerCase().includes(s.toLowerCase()))) {
    return new NextResponse("Bad Request", {
      status: 400,
      headers: { "X-Request-Id": requestId },
    });
  }

  // 5. Generate CSP nonce and build response with security headers
  const nonce = generateNonce();
  const response = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers.entries()),
        "x-nonce": nonce,
        "x-request-id": requestId,
        "x-real-ip": ip,
      }),
    },
  });

  // 6. Attach all security headers
  const csp = buildCSP(nonce);
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-RateLimit-Remaining", String(globalLimit.remaining));

  // 7. Remove server fingerprinting headers
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)).*)",
  ],
};
