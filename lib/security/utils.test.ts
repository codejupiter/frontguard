// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, decodeMockToken, generateMockToken, hasPermission, sanitizeHTML } from "./utils";

describe("sanitizeHTML", () => {
  it("renders untrusted markup as escaped text in the browser", () => {
    expect(sanitizeHTML('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=\"alert(1)\"&gt;");
  });
});

describe("rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-14T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks calls after the configured limit until the window resets", () => {
    expect(checkRateLimit("ip:127.0.0.1", 2, 1000)).toBe(true);
    expect(checkRateLimit("ip:127.0.0.1", 2, 1000)).toBe(true);
    expect(checkRateLimit("ip:127.0.0.1", 2, 1000)).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(checkRateLimit("ip:127.0.0.1", 2, 1000)).toBe(true);
  });
});

describe("mock tokens", () => {
  it("encodes and decodes role claims for the demo auth flow", () => {
    const token = generateMockToken("admin", "admin");
    expect(decodeMockToken(token)).toMatchObject({ sub: "admin", role: "admin" });
  });

  it("returns null for malformed tokens", () => {
    expect(decodeMockToken("not-a-token")).toBeNull();
  });
});

describe("hasPermission", () => {
  it("checks demo RBAC permissions by role", () => {
    expect(hasPermission("admin", "delete")).toBe(true);
    expect(hasPermission("user", "delete")).toBe(false);
    expect(hasPermission("guest", "read")).toBe(true);
    expect(hasPermission("unknown", "read")).toBe(false);
  });
});
