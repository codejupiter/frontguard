import { describe, expect, it } from "vitest";
import {
  authorizeProjectAccess,
  getProjectAccessSummary,
} from "./eventProjectAccess";

describe("project access control", () => {
  it("keeps dashboard reads open when no project access tokens are configured", () => {
    expect(authorizeProjectAccess({ appId: "frontguard-agent-demo" }, null, "viewer", {})).toEqual({
      ok: true,
      mode: "open-demo",
      scope: "*",
      role: "admin",
      filters: { appId: "frontguard-agent-demo" },
    });
  });

  it("requires a token when project access tokens are configured", () => {
    expect(
      authorizeProjectAccess(
        { orgId: "frontguard-labs" },
        null,
        "viewer",
        {
          FRONTGUARD_PROJECT_ACCESS_TOKENS:
            "frontguard-labs/agent-demo:viewer=fgv_test_token_123456",
        }
      )
    ).toMatchObject({
      ok: false,
      status: 401,
    });
  });

  it("narrows reads to the token scope", () => {
    const env = {
      FRONTGUARD_PROJECT_ACCESS_TOKENS:
        "frontguard-labs/agent-demo:viewer=fgv_test_token_123456",
    };

    expect(authorizeProjectAccess({}, "fgv_test_token_123456", "viewer", env)).toEqual({
      ok: true,
      mode: "token",
      scope: "frontguard-labs/agent-demo",
      role: "viewer",
      filters: {
        orgId: "frontguard-labs",
        projectId: "agent-demo",
      },
    });

    expect(
      authorizeProjectAccess(
        { orgId: "portfolio-demo" },
        "fgv_test_token_123456",
        "viewer",
        env
      )
    ).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("enforces role rank for project actions", () => {
    const env = {
      FRONTGUARD_PROJECT_ACCESS_TOKENS:
        "frontguard-labs/agent-demo:viewer=fgv_test_token_123456",
    };

    expect(
      authorizeProjectAccess(
        { orgId: "frontguard-labs", projectId: "agent-demo" },
        "fgv_test_token_123456",
        "triager",
        env
      )
    ).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it("summarizes project scopes without exposing token values", () => {
    expect(
      getProjectAccessSummary({
        FRONTGUARD_PROJECT_ACCESS_TOKENS:
          "frontguard-labs/agent-demo:viewer=fgv_test_token_123456,*:admin=fga_test_token_123456",
      })
    ).toEqual({
      mode: "token",
      tokenScopes: [
        { scope: "frontguard-labs/agent-demo", role: "viewer" },
        { scope: "*", role: "admin" },
      ],
    });
  });
});
