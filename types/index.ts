export type SecurityMode = "attack" | "secure";

export type Role = "admin" | "user" | "guest";

export type LogEventType = "DOM" | "Network" | "CSP" | "Script" | "Auth" | "RBAC" | "global";
export type LogSeverity = "critical" | "high" | "medium" | "low" | "info";
export type LogAction = "blocked" | "allowed" | "logged" | "flagged" | "injected" | "enforced";

export interface LogEntry {
  id: string;
  timestamp: Date;
  // Legacy type kept for compatibility
  type: "request" | "error" | "exploit" | "blocked" | "info";
  // New rich fields
  eventType?: LogEventType;
  severity?: LogSeverity;
  action?: LogAction;
  source?: string;
  origin?: string;
  detail?: string;
  message: string;
  module: string;
  // Attack simulation burst marker
  isBurst?: boolean;
}

export interface User {
  id: string;
  username: string;
  role: Role;
  token: string;
}

export interface ModuleInfo {
  id: string;
  label: string;
  icon: string;
  path: string;
  description: string;
}
