// Sanitize HTML to prevent XSS
export function sanitizeHTML(input: string): string {
  if (typeof window === "undefined") return input;
  // Simple sanitizer for demo — in prod use DOMPurify
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

// Rate limiter simulation
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 5, windowMs = 10000): boolean {
  const now = Date.now();
  const entry = requestCounts.get(key);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (entry.count >= limit) return false; // blocked
  entry.count++;
  return true;
}

// Mock JWT generation (NOT real JWT)
export function generateMockToken(userId: string, role: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({ sub: userId, role, iat: Date.now(), exp: Date.now() + 3600000 })
  );
  const sig = btoa("mock-signature");
  return `${header}.${payload}.${sig}`;
}

export function decodeMockToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

// RBAC check
export function hasPermission(role: string, action: string): boolean {
  const permissions: Record<string, string[]> = {
    admin: ["read", "write", "delete", "manage"],
    user: ["read", "write"],
    guest: ["read"],
  };
  return permissions[role]?.includes(action) ?? false;
}
