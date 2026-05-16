import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dispatchSecurityEventAlert,
  getSecurityEventAlertPolicy,
  shouldAlertForSeverity,
} from "./eventAlerts";
import type { IngestedSecurityEvent } from "./eventIngestion";

function makeEvent(
  overrides: Partial<IngestedSecurityEvent> = {}
): IngestedSecurityEvent {
  return {
    id: "evt_123",
    type: "dom.script-injected",
    severity: "critical",
    timestamp: Date.parse("2026-05-15T20:00:00.000Z"),
    url: "https://frontguard-agent.vercel.app",
    details: { src: "https://evil.example/skimmer.js" },
    orgId: "frontguard-labs",
    orgName: "FrontGuard Labs",
    projectId: "agent-demo",
    projectName: "Agent Runtime Demo",
    appId: "frontguard-agent-demo",
    environment: "production",
    release: "agent-v1",
    sessionId: "session_123",
    userId: "user_123",
    receivedAt: "2026-05-15T20:00:01.000Z",
    requestId: "req_123",
    sourceIp: "203.0.113.10",
    userAgent: "Vitest",
    ...overrides,
  };
}

describe("security event alerts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("defaults to audit-only critical alerts with a bounded timeout", () => {
    expect(getSecurityEventAlertPolicy({})).toEqual({
      mode: "audit-only",
      minSeverity: "critical",
      webhookConfigured: false,
      timeoutMs: 2500,
    });

    expect(
      getSecurityEventAlertPolicy({
        FRONTGUARD_ALERT_MIN_SEVERITY: "medium",
        FRONTGUARD_ALERT_TIMEOUT_MS: "25",
      })
    ).toMatchObject({
      minSeverity: "medium",
      timeoutMs: 500,
    });
  });

  it("honors the configured severity threshold", async () => {
    const policy = getSecurityEventAlertPolicy({
      FRONTGUARD_ALERT_MIN_SEVERITY: "high",
    });

    expect(shouldAlertForSeverity("medium", policy)).toBe(false);
    expect(shouldAlertForSeverity("high", policy)).toBe(true);
    expect(
      await dispatchSecurityEventAlert([makeEvent({ severity: "medium" })], {
        FRONTGUARD_ALERT_MIN_SEVERITY: "high",
      })
    ).toEqual({
      triggered: false,
      delivered: false,
      mode: "audit-only",
      severity: "medium",
    });
  });

  it("records an audit-only alert when no webhook is configured", async () => {
    await expect(dispatchSecurityEventAlert([makeEvent()], {})).resolves.toEqual({
      triggered: true,
      delivered: false,
      mode: "audit-only",
      severity: "critical",
    });
  });

  it("posts critical alert payloads to the configured webhook", async () => {
    const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => ReturnType<typeof fetch>>(
      async () => new Response("accepted", { status: 202 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchSecurityEventAlert([makeEvent()], {
      FRONTGUARD_ALERT_WEBHOOK_URL: "https://alerts.example.com/frontguard",
      FRONTGUARD_ALERT_WEBHOOK_TOKEN: "alert_token_123456",
      FRONTGUARD_ALERT_MIN_SEVERITY: "high",
    });

    expect(result).toEqual({
      triggered: true,
      delivered: true,
      mode: "webhook",
      severity: "critical",
      status: 202,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://alerts.example.com/frontguard",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: expect.objectContaining({
          authorization: "Bearer alert_token_123456",
          "content-type": "application/json",
        }),
      })
    );

    const init = fetchMock.mock.calls[0]?.[1];
    if (!init) throw new Error("missing webhook request init");
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      type: "frontguard.security_event_alert",
      severity: "critical",
      eventCount: 1,
      orgIds: ["frontguard-labs"],
      projectIds: ["agent-demo"],
      appIds: ["frontguard-agent-demo"],
    });
  });

  it("returns delivery errors without failing ingestion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("failed", { status: 500 }))
    );

    await expect(
      dispatchSecurityEventAlert([makeEvent()], {
        FRONTGUARD_ALERT_WEBHOOK_URL: "https://alerts.example.com/frontguard",
      })
    ).resolves.toMatchObject({
      triggered: true,
      delivered: false,
      mode: "webhook",
      severity: "critical",
      status: 500,
      error: "Webhook returned HTTP 500",
    });
  });
});
