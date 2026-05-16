import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSecurityEvents,
  getHighestSeverity,
  getSecurityEvents,
  getSecurityEventSummary,
  getSecurityEventRetentionPolicy,
  ingestSecurityEventEnvelope,
  validateSecurityEventEnvelope,
} from "./eventIngestion";

const validEnvelope = {
  orgId: "frontguard-labs",
  projectId: "playground",
  appId: "frontguard-playground",
  environment: "preview",
  release: "suite-v2-demo",
  sessionId: "demo-session-1",
  userId: "operator-1",
  events: [
    {
      type: "dom.script-injected",
      severity: "critical",
      timestamp: Date.parse("2026-05-15T20:00:00.000Z"),
      url: "https://frontguard-nine.vercel.app/security-events",
      details: {
        src: "https://evil.example/skimmer.js",
        inlinePreview: "<script>alert(1)</script>",
        allowlisted: false,
      },
    },
  ],
};

describe("validateSecurityEventEnvelope", () => {
  it("accepts and sanitizes the FrontGuard Agent event contract", () => {
    const result = validateSecurityEventEnvelope(validEnvelope);
    if (!result.ok) throw new Error(result.errors.join(", "));

    expect(result.data).toMatchObject({
      orgId: "frontguard-labs",
      projectId: "playground",
      appId: "frontguard-playground",
      environment: "preview",
      release: "suite-v2-demo",
      events: [
        {
          type: "dom.script-injected",
          severity: "critical",
          url: "https://frontguard-nine.vercel.app/security-events",
        },
      ],
    });
    expect(result.data.events[0].details.inlinePreview).toBe("alert(1)");
  });

  it("rejects invalid event types, environments, and urls", () => {
    const result = validateSecurityEventEnvelope({
      appId: "frontguard-playground",
      environment: "staging",
      events: [
        {
          type: "network.request",
          severity: "critical",
          timestamp: Date.now(),
          url: "javascript:alert(1)",
          details: {},
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        "environment must be production, preview, or development",
        "events[0].type is invalid",
        "events[0].event.url must use http or https",
      ],
    });
  });

  it("caps each envelope to a small batch size", () => {
    const result = validateSecurityEventEnvelope({
      appId: "frontguard-playground",
      environment: "preview",
      events: Array.from({ length: 26 }, (_, index) => ({
        type: "dom.iframe-injected",
        severity: "high",
        timestamp: Date.now() + index,
        url: "https://frontguard-nine.vercel.app",
        details: {},
      })),
    });

    expect(result).toMatchObject({
      ok: false,
      errors: ["events cannot include more than 25 items"],
    });
  });
});

describe("security event store", () => {
  beforeEach(async () => {
    await clearSecurityEvents();
  });

  it("ingests events with request context and returns a summary", async () => {
    const result = validateSecurityEventEnvelope(validEnvelope);
    if (!result.ok) throw new Error(result.errors.join(", "));

    const ingested = await ingestSecurityEventEnvelope(result.data, {
      requestId: "req_123",
      sourceIp: "203.0.113.10",
      userAgent: "Playwright",
    });

    expect(ingested).toHaveLength(1);
    expect(ingested[0]).toMatchObject({
      orgId: "frontguard-labs",
      projectId: "playground",
      appId: "frontguard-playground",
      requestId: "req_123",
      sourceIp: "203.0.113.10",
      severity: "critical",
    });

    expect(getSecurityEventSummary(await getSecurityEvents())).toMatchObject({
      total: 1,
      orgs: 1,
      projects: 1,
      apps: 1,
      storageMode: "memory",
      bySeverity: { low: 0, medium: 0, high: 0, critical: 1 },
      byType: {
        "dom.script-injected": 1,
        "dom.iframe-injected": 0,
        "dom.suspicious-attribute": 0,
      },
    });
  });

  it("filters events by workspace, project, severity, and resolves highest severity", async () => {
    const result = validateSecurityEventEnvelope({
      appId: "frontguard-playground",
      environment: "preview",
      events: [
        {
          type: "dom.suspicious-attribute",
          severity: "high",
          timestamp: Date.now(),
          url: "https://frontguard-nine.vercel.app",
          details: { attribute: "onerror" },
        },
        {
          type: "dom.iframe-injected",
          severity: "medium",
          timestamp: Date.now(),
          url: "https://frontguard-nine.vercel.app",
          details: { src: "https://ads.example/frame" },
        },
      ],
    });
    if (!result.ok) throw new Error(result.errors.join(", "));

    const ingested = await ingestSecurityEventEnvelope(result.data, {
      requestId: "req_456",
      sourceIp: "203.0.113.11",
      userAgent: "Vitest",
    });

    expect(await getSecurityEvents({ orgId: "frontguard-labs" })).toHaveLength(2);
    expect(await getSecurityEvents({ projectId: "playground" })).toHaveLength(2);
    expect(await getSecurityEvents({ severity: "high" })).toHaveLength(1);
    expect(getHighestSeverity(ingested)).toBe("high");
  });

  it("reads bounded retention policy from environment values", () => {
    expect(
      getSecurityEventRetentionPolicy({
        FRONTGUARD_EVENT_MAX_EVENTS: "1200",
        FRONTGUARD_EVENT_RETENTION_DAYS: "30",
      })
    ).toEqual({
      maxStoredEvents: 1200,
      retentionDays: 30,
      retentionSeconds: 30 * 24 * 60 * 60,
    });

    expect(
      getSecurityEventRetentionPolicy({
        FRONTGUARD_EVENT_MAX_EVENTS: "999999",
        FRONTGUARD_EVENT_RETENTION_DAYS: "0",
      })
    ).toMatchObject({
      maxStoredEvents: 10000,
      retentionDays: null,
      retentionSeconds: null,
    });
  });
});
