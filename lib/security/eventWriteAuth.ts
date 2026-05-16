import { sanitizeString } from "./sanitize";
import type { FrontGuardEventEnvelope } from "./eventIngestion";

export type EventWriteAuthMode = "open-demo" | "token";
export type EventWriteAuthDecision =
  | { ok: true; mode: EventWriteAuthMode; scope: string }
  | { ok: false; mode: EventWriteAuthMode; status: 401 | 403; reason: string };

export interface EventWriteAuthSummary {
  mode: EventWriteAuthMode;
  tokenScopes: string[];
  adminMode: EventWriteAuthMode;
}

interface EventWriteTokenRule {
  scope: string;
  token: string;
}

type EnvLike = Record<string, string | undefined>;

function sanitizeScope(value: string): string {
  return sanitizeString(value, 180).replace(/[^a-zA-Z0-9_.:@/*-]/g, "");
}

function parseEventWriteTokenRules(value: string | undefined): EventWriteTokenRule[] {
  if (!value) return [];

  return value
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex < 1) return [];

      const scope = sanitizeScope(entry.slice(0, separatorIndex).trim());
      const token = entry.slice(separatorIndex + 1).trim();
      if (!scope || token.length < 12) return [];

      return [{ scope, token }];
    });
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index++) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

function possibleScopes(envelope: Pick<FrontGuardEventEnvelope, "orgId" | "projectId" | "appId">): string[] {
  const orgId = envelope.orgId;
  const projectId = envelope.projectId;
  const appId = envelope.appId;

  return [
    "*",
    ...(orgId ? [orgId] : []),
    ...(orgId && projectId ? [`${orgId}/${projectId}`] : []),
    ...(orgId && projectId ? [`${orgId}/${projectId}/${appId}`] : []),
  ];
}

function readHeaderToken(headers: Headers, names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value.trim();
  }

  const authorization = headers.get("authorization");
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export function readEventWriteToken(headers: Headers): string | null {
  return readHeaderToken(headers, ["x-frontguard-event-token"]);
}

export function readAdminToken(headers: Headers): string | null {
  return readHeaderToken(headers, ["x-frontguard-admin-token"]);
}

export function authorizeEventWrite(
  envelope: Pick<FrontGuardEventEnvelope, "orgId" | "projectId" | "appId">,
  token: string | null,
  env: EnvLike = process.env
): EventWriteAuthDecision {
  const rules = parseEventWriteTokenRules(env.FRONTGUARD_EVENT_WRITE_TOKENS);
  if (rules.length === 0) return { ok: true, mode: "open-demo", scope: "*" };

  if (!token) {
    return {
      ok: false,
      mode: "token",
      status: 401,
      reason: "Missing FrontGuard event write token",
    };
  }

  const scopes = possibleScopes(envelope);
  const matched = rules.find(
    (rule) =>
      scopes.includes(rule.scope) &&
      timingSafeStringEqual(rule.token, token)
  );

  if (!matched) {
    return {
      ok: false,
      mode: "token",
      status: 403,
      reason: "FrontGuard event write token is not allowed for this scope",
    };
  }

  return { ok: true, mode: "token", scope: matched.scope };
}

export function authorizeAdminAction(
  token: string | null,
  env: EnvLike = process.env
): EventWriteAuthDecision {
  const adminToken = env.FRONTGUARD_ADMIN_TOKEN?.trim();
  if (!adminToken) return { ok: true, mode: "open-demo", scope: "*" };

  if (!token) {
    return {
      ok: false,
      mode: "token",
      status: 401,
      reason: "Missing FrontGuard admin token",
    };
  }

  if (!timingSafeStringEqual(adminToken, token)) {
    return {
      ok: false,
      mode: "token",
      status: 403,
      reason: "FrontGuard admin token is invalid",
    };
  }

  return { ok: true, mode: "token", scope: "admin" };
}

export function getEventWriteAuthSummary(
  env: EnvLike = process.env
): EventWriteAuthSummary {
  const rules = parseEventWriteTokenRules(env.FRONTGUARD_EVENT_WRITE_TOKENS);
  return {
    mode: rules.length > 0 ? "token" : "open-demo",
    tokenScopes: rules.map((rule) => rule.scope),
    adminMode: env.FRONTGUARD_ADMIN_TOKEN?.trim() ? "token" : "open-demo",
  };
}
