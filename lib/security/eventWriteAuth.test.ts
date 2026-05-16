import { describe, expect, it } from "vitest";
import {
  authorizeAdminAction,
  authorizeEventWrite,
  getEventWriteAuthSummary,
} from "./eventWriteAuth";

const envelope = {
  orgId: "frontguard-labs",
  projectId: "agent-demo",
  appId: "frontguard-agent-demo",
};

describe("event write authorization", () => {
  it("keeps the demo open when no write tokens are configured", () => {
    expect(authorizeEventWrite(envelope, null, {})).toEqual({
      ok: true,
      mode: "open-demo",
      scope: "*",
    });
  });

  it("requires a token when scoped write tokens are configured", () => {
    expect(
      authorizeEventWrite(envelope, null, {
        FRONTGUARD_EVENT_WRITE_TOKENS:
          "frontguard-labs/agent-demo=fgw_test_token_123456",
      })
    ).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("matches write tokens by org/project/app scope", () => {
    const env = {
      FRONTGUARD_EVENT_WRITE_TOKENS: [
        "portfolio-demo/docs-portal=wrong_token_123456",
        "frontguard-labs/agent-demo=fgw_test_token_123456",
      ].join(","),
    };

    expect(authorizeEventWrite(envelope, "fgw_test_token_123456", env)).toEqual({
      ok: true,
      mode: "token",
      scope: "frontguard-labs/agent-demo",
    });
    expect(authorizeEventWrite(envelope, "wrong_token_123456", env)).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("summarizes token and admin modes without exposing token values", () => {
    expect(
      getEventWriteAuthSummary({
        FRONTGUARD_EVENT_WRITE_TOKENS:
          "frontguard-labs/agent-demo=fgw_test_token_123456",
        FRONTGUARD_ADMIN_TOKEN: "admin_token_123456",
      })
    ).toEqual({
      mode: "token",
      tokenScopes: ["frontguard-labs/agent-demo"],
      adminMode: "token",
    });
  });

  it("authorizes admin actions only when the configured token matches", () => {
    const env = { FRONTGUARD_ADMIN_TOKEN: "admin_token_123456" };

    expect(authorizeAdminAction(null, env)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(authorizeAdminAction("wrong_token_123456", env)).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(authorizeAdminAction("admin_token_123456", env)).toEqual({
      ok: true,
      mode: "token",
      scope: "admin",
    });
  });
});
