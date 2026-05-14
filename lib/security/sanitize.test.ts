import { describe, expect, it } from "vitest";
import {
  checkInputThreats,
  escapeHTML,
  hasNoSQLInjection,
  hasPathTraversal,
  hasSQLInjection,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  sanitizeString,
  stripControlChars,
  stripHTML,
} from "./sanitize";

describe("sanitizeString", () => {
  it("trims, strips tags, removes control characters, and truncates input", () => {
    expect(sanitizeString("  <script>alert(1)</script>Hello\u0000World  ", 10)).toBe("alert(1)He");
  });

  it("returns an empty string for non-string input", () => {
    expect(sanitizeString({ value: "nope" })).toBe("");
  });
});

describe("string sanitizers", () => {
  it("escapes HTML entities", () => {
    expect(escapeHTML(`<img src=x onerror="alert('x')" />`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#x27;x&#x27;)&quot; &#x2F;&gt;"
    );
  });

  it("strips tags and control characters independently", () => {
    expect(stripHTML("<strong>safe</strong> text")).toBe("safe text");
    expect(stripControlChars("safe\u0007text")).toBe("safetext");
  });
});

describe("validators", () => {
  it("validates email, username, and password constraints", () => {
    expect(isValidEmail("dev@example.com")).toBe(true);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidUsername("code_jupiter")).toBe(true);
    expect(isValidUsername("no spaces")).toBe(false);
    expect(isValidPassword("12345678")).toBe(true);
    expect(isValidPassword("short")).toBe(false);
  });
});

describe("threat detection", () => {
  it("detects common injection patterns", () => {
    expect(hasSQLInjection("1 OR 1=1")).toBe(true);
    expect(hasNoSQLInjection('{"$ne": null}')).toBe(true);
    expect(hasPathTraversal("../etc/passwd")).toBe(true);
  });

  it("returns the first actionable threat reason", () => {
    expect(checkInputThreats("<script>alert(1)</script>")).toEqual({
      safe: false,
      reason: "Script injection detected",
    });
    expect(checkInputThreats("plain search query")).toEqual({ safe: true });
  });
});
