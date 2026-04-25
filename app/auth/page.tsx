"use client";

import { useState } from "react";
import { useSecurity } from "@/lib/store/SecurityContext";
import { ModeCard, SectionHeader, StatusBadge } from "@/components/ui/primitives";
import InfoPanel from "@/components/ui/InfoPanel";
import LogsPanel from "@/components/layout/LogsPanel";
import HintBar from "@/components/ui/HintBar";
import SimulateAttackButton from "@/components/ui/SimulateAttackButton";
import { generateMockToken, decodeMockToken } from "@/lib/security/utils";
import { KeyRound, Eye, EyeOff, LogOut, User, Cookie, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const FAKE_USERS = [
  { username: "admin", password: "admin123", role: "admin" },
  { username: "alice", password: "password", role: "user" },
  { username: "guest", password: "guest", role: "guest" },
];

export default function AuthPage() {
  const { mode, addLog, setCurrentUser, currentUser } = useSecurity();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const [storedToken, setStoredToken] = useState<string | null>(null);

  const getTokenFromStorage = () => {
    if (typeof window === "undefined") return null;
    if (mode === "attack") {
      return localStorage.getItem("fg_token");
    }
    // Simulate httpOnly — not accessible
    return null;
  };

  const handleLogin = () => {
    setError("");
    const match = FAKE_USERS.find(
      (u) => u.username === username && u.password === password
    );
    if (!match) {
      setError("Invalid credentials");
      addLog({ type: "error", message: "Failed login attempt", detail: `Username: ${username}`, module: "auth" });
      return;
    }

    const token = generateMockToken(match.username, match.role);
    const user = { id: match.username, username: match.username, role: match.role as "admin" | "user" | "guest", token };

    if (mode === "attack") {
      // INSECURE: store in localStorage
      localStorage.setItem("fg_token", token);
      localStorage.setItem("fg_user", JSON.stringify({ username: match.username, role: match.role }));
      setStoredToken(token);
      addLog({
        type: "exploit",
        message: "Token stored in localStorage — accessible via JS",
        detail: `Token: ${token.slice(0, 40)}...`,
        module: "auth",
      });
    } else {
      // SECURE: simulate httpOnly cookie (can't be read by JS)
      setStoredToken("[httpOnly cookie — not readable by JavaScript]");
      addLog({
        type: "blocked",
        message: "Token stored in httpOnly cookie — JS cannot read it",
        detail: `User: ${match.username} (${match.role})`,
        module: "auth",
      });
    }

    setCurrentUser(user);
  };

  const handleLogout = () => {
    if (mode === "attack") {
      localStorage.removeItem("fg_token");
      localStorage.removeItem("fg_user");
    }
    setStoredToken(null);
    setCurrentUser(null);
    addLog({ type: "info", message: "User logged out", module: "auth" });
  };

  const handleDevToolsSnoop = () => {
    const token = localStorage.getItem("fg_token");
    if (token) {
      const decoded = decodeMockToken(token);
      addLog({
        type: "exploit",
        message: "Token read from localStorage via JS (simulated XSS/DevTools attack)",
        detail: `Payload: ${JSON.stringify(decoded)}`,
        module: "auth",
      });
      setTokenVisible(true);
    } else {
      addLog({
        type: "blocked",
        message: "Cannot read token — not stored in localStorage",
        module: "auth",
      });
    }
  };

  const lsToken = getTokenFromStorage();
  const decoded = lsToken ? decodeMockToken(lsToken) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <SectionHeader
          title="Auth Simulation"
          description="Compare insecure localStorage token storage vs secure httpOnly cookie simulation."
        />
        <SimulateAttackButton />
      </div>
      <HintBar module="auth" />

      {/* Credentials hint */}
      <div className="border border-zinc-800 rounded-lg p-3 bg-[#0d0d15]">
        <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest mb-2">Test Credentials</p>
        <div className="flex gap-6">
          {FAKE_USERS.map((u) => (
            <button
              key={u.username}
              onClick={() => { setUsername(u.username); setPassword(u.password); }}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span className="text-zinc-600">{u.role}: </span>
              {u.username} / {u.password}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Login Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-mono">Login</h3>
            <StatusBadge secure={mode === "secure"} />
          </div>

          {currentUser ? (
            <div className={clsx(
              "border rounded-xl p-5 space-y-4",
              mode === "attack" ? "border-red-500/20 bg-red-950/5" : "border-emerald-500/20 bg-emerald-950/5"
            )}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <User size={18} className="text-zinc-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white font-mono">{currentUser.username}</p>
                  <p className="text-xs text-zinc-500 font-mono">{currentUser.role}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-all"
              >
                <LogOut size={12} /> Logout
              </button>
            </div>
          ) : (
            <div className="border border-[#1a1a2e] rounded-xl p-5 bg-[#0d0d15] space-y-3">
              <div>
                <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest block mb-1.5">Username</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/30 border border-[#1a1a2e] rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                  placeholder="e.g. admin"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest block mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    className="w-full bg-black/30 border border-[#1a1a2e] rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                  >
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
              <button
                onClick={handleLogin}
                className={clsx(
                  "w-full py-2 rounded-lg text-sm font-mono font-bold transition-all",
                  mode === "attack"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                )}
              >
                <KeyRound size={13} className="inline mr-2" />
                Login
              </button>
            </div>
          )}
        </div>

        {/* Token Inspector */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white font-mono">Token Storage Inspector</h3>

          <ModeCard mode="attack" title="Insecure: localStorage">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <AlertTriangle size={11} className="text-orange-400" />
                Accessible via <code className="text-orange-300">localStorage.getItem()</code>
              </div>
              <div className="bg-black/40 border border-red-500/20 rounded-lg p-3 text-[10px] font-mono text-zinc-400 break-all min-h-[60px]">
                {mode === "attack" && lsToken
                  ? <span className="text-orange-300">{lsToken}</span>
                  : <span className="text-zinc-700">No token in localStorage</span>
                }
              </div>
              {mode === "attack" && lsToken && (
                <button
                  onClick={handleDevToolsSnoop}
                  className="w-full text-xs font-mono text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg py-2 hover:bg-red-400/10 transition-all"
                >
                  Simulate XSS Token Theft
                </button>
              )}
            </div>
          </ModeCard>

          <ModeCard mode="secure" title="Secure: httpOnly Cookie">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <Cookie size={11} className="text-emerald-400" />
                JS cannot access <code className="text-emerald-300">document.cookie</code> for httpOnly
              </div>
              <div className="bg-black/40 border border-emerald-500/20 rounded-lg p-3 text-[10px] font-mono text-zinc-400 min-h-[60px]">
                {mode === "secure" && currentUser
                  ? <span className="text-emerald-400">✓ Token set as httpOnly — not readable by JavaScript</span>
                  : <span className="text-zinc-700">Login in Secure Mode to see cookie simulation</span>
                }
              </div>
            </div>
          </ModeCard>

          {/* Decoded payload */}
          {mode === "attack" && decoded && tokenVisible && (
            <div className="border border-orange-500/30 rounded-xl p-4 bg-orange-950/10">
              <p className="text-[10px] font-mono text-orange-400 uppercase tracking-widest mb-2">⚠ Decoded JWT Payload (stolen)</p>
              <pre className="text-[10px] font-mono text-zinc-300 overflow-auto">
                {JSON.stringify(decoded, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <InfoPanel
        what="After login, the server issues a token (JWT) to identify the user. Where this token is stored determines how attackable it is. localStorage is synchronous and directly accessible via JavaScript."
        why="Storing auth tokens in localStorage means any JavaScript on the page — including injected XSS payloads — can read them. An attacker with XSS can call localStorage.getItem() and exfiltrate your session token."
        fix="Use httpOnly cookies for auth tokens. These are sent automatically with requests but are invisible to JavaScript. This completely blocks XSS-based token theft. Pair with Secure and SameSite=Strict cookie flags."
        realWorld="Many SPAs (React, Angular) mistakenly use localStorage for JWTs. High-profile breaches have used XSS to steal tokens from exactly this pattern. Auth0's documentation explicitly warns against it."
      />

      <LogsPanel module="auth" />
    </div>
  );
}
