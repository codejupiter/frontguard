import { sanitizeString } from "./sanitize";
import type { SecurityEventFilters } from "./eventIngestion";

export type ProjectRole = "viewer" | "triager" | "admin";
export type ProjectAccessMode = "open-demo" | "token";

export interface ProjectAccessRuleSummary {
  scope: string;
  role: ProjectRole;
}

export interface ProjectAccessSummary {
  mode: ProjectAccessMode;
  tokenScopes: ProjectAccessRuleSummary[];
}

export type ProjectAccessDecision =
  | {
      ok: true;
      mode: ProjectAccessMode;
      scope: string;
      role: ProjectRole;
      filters: SecurityEventFilters;
    }
  | {
      ok: false;
      mode: ProjectAccessMode;
      status: 401 | 403;
      reason: string;
    };

interface ProjectAccessTokenRule {
  scope: string;
  token: string;
  role: ProjectRole;
}

interface ParsedScope {
  orgId?: string;
  projectId?: string;
  appId?: string;
}

type EnvLike = Record<string, string | undefined>;

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 1,
  triager: 2,
  admin: 3,
};

function sanitizeScope(value: string): string {
  return sanitizeString(value, 180).replace(/[^a-zA-Z0-9_.:@/*-]/g, "");
}

function isProjectRole(value: string): value is ProjectRole {
  return value === "viewer" || value === "triager" || value === "admin";
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index++) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

function parseRuleSubject(subject: string): { scope: string; role: ProjectRole } | null {
  const roleSeparator = subject.lastIndexOf(":");
  const rawScope = roleSeparator > -1 ? subject.slice(0, roleSeparator) : subject;
  const rawRole = roleSeparator > -1 ? subject.slice(roleSeparator + 1) : "viewer";
  const role = isProjectRole(rawRole) ? rawRole : undefined;
  const scope = sanitizeScope(rawScope.trim());

  if (!scope || !role) return null;
  return { scope, role };
}

function parseProjectAccessTokenRules(value: string | undefined): ProjectAccessTokenRule[] {
  if (!value) return [];

  return value
    .split(/[\n,;]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex < 1) return [];

      const subject = parseRuleSubject(entry.slice(0, separatorIndex).trim());
      const token = entry.slice(separatorIndex + 1).trim();
      if (!subject || token.length < 12) return [];

      return [{ ...subject, token }];
    });
}

function parseScope(scope: string): ParsedScope | null {
  if (scope === "*") return {};

  const [orgId, projectId, appId, extra] = scope.split("/");
  if (!orgId || extra) return null;

  return {
    orgId,
    ...(projectId && { projectId }),
    ...(projectId && appId && { appId }),
  };
}

function mergeScopeWithFilters(
  scope: string,
  filters: SecurityEventFilters
): SecurityEventFilters | null {
  const parsed = parseScope(scope);
  if (!parsed) return null;

  if (parsed.orgId && filters.orgId && filters.orgId !== parsed.orgId) return null;
  if (parsed.projectId && filters.projectId && filters.projectId !== parsed.projectId) {
    return null;
  }
  if (parsed.appId && filters.appId && filters.appId !== parsed.appId) return null;

  return {
    ...filters,
    ...(parsed.orgId && { orgId: parsed.orgId }),
    ...(parsed.projectId && { projectId: parsed.projectId }),
    ...(parsed.appId && { appId: parsed.appId }),
  };
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

export function readProjectAccessToken(headers: Headers): string | null {
  return readHeaderToken(headers, ["x-frontguard-access-token"]);
}

export function authorizeProjectAccess(
  filters: SecurityEventFilters,
  token: string | null,
  requiredRole: ProjectRole = "viewer",
  env: EnvLike = process.env
): ProjectAccessDecision {
  const rules = parseProjectAccessTokenRules(env.FRONTGUARD_PROJECT_ACCESS_TOKENS);
  if (rules.length === 0) {
    return { ok: true, mode: "open-demo", scope: "*", role: "admin", filters };
  }

  if (!token) {
    return {
      ok: false,
      mode: "token",
      status: 401,
      reason: "Missing FrontGuard project access token",
    };
  }

  const tokenRules = rules.filter((rule) => timingSafeStringEqual(rule.token, token));
  for (const rule of tokenRules) {
    if (ROLE_RANK[rule.role] < ROLE_RANK[requiredRole]) continue;

    const scopedFilters = mergeScopeWithFilters(rule.scope, filters);
    if (scopedFilters) {
      return {
        ok: true,
        mode: "token",
        scope: rule.scope,
        role: rule.role,
        filters: scopedFilters,
      };
    }
  }

  return {
    ok: false,
    mode: "token",
    status: 403,
    reason: "FrontGuard project access token is not allowed for this scope",
  };
}

export function getProjectAccessSummary(
  env: EnvLike = process.env
): ProjectAccessSummary {
  const rules = parseProjectAccessTokenRules(env.FRONTGUARD_PROJECT_ACCESS_TOKENS);
  return {
    mode: rules.length > 0 ? "token" : "open-demo",
    tokenScopes: rules.map(({ scope, role }) => ({ scope, role })),
  };
}
