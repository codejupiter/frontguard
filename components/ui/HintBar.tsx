"use client";

import { useState } from "react";
import { Lightbulb, X, ChevronRight } from "lucide-react";
import { useSecurity } from "@/lib/store/SecurityContext";
import clsx from "clsx";

interface Hint {
  attack: string[];
  secure: string[];
}

const MODULE_HINTS: Record<string, Hint> = {
  xss: {
    attack: [
      'Click a quick payload button, then hit "Render" to inject it',
      "Watch the left panel — your script will actually execute",
      "Open browser DevTools console to see the alert fire",
      "Try the Cookie Stealer payload — it would steal your session token on a real site",
    ],
    secure: [
      "Hit Render with the same payload — notice the output is plain text now",
      "The HTML tags are escaped: < becomes &lt;, > becomes &gt;",
      "No script executes. The browser never parses it as HTML",
      "Check the log — it says 'blocked' instead of 'exploit'",
    ],
  },
  auth: {
    attack: [
      "Log in with any test credential (e.g. admin / admin123)",
      "Open DevTools → Application → Local Storage to see your token",
      "Click 'Simulate XSS Token Theft' to see how an attacker reads it",
      "Decode the JWT at jwt.io — all your user data is readable",
    ],
    secure: [
      "Log in again — the token is now in an httpOnly cookie",
      "Open DevTools → Application → Cookies — you can see it exists",
      "But you cannot read it with JavaScript. Try: document.cookie in the console",
      "The 'Simulate XSS Token Theft' button finds nothing to steal",
    ],
  },
  "api-security": {
    attack: [
      'Click "Fetch Without Auth" — watch it return full user data including SSN',
      "Notice no Authorization header is required",
      "Click 'Simulate Spam' — all 6 requests succeed with no throttling",
      "Open DevTools Network tab to see the raw API response",
    ],
    secure: [
      'Click "Fetch Without Auth" in Secure Mode — you get a 401 Unauthorized',
      'Click "Fetch With Auth Token" — this succeeds but SSN/salary are stripped',
      "Run 'Simulate Spam' — after 3 requests you hit a 429 Rate Limited",
      "Each successful response shows remaining rate limit in the request log",
    ],
  },
  rbac: {
    attack: [
      "Select 'guest' role, then try the 'Delete Record' action",
      "Now open DevTools console and type: window.__role = 'admin'",
      "The UI immediately unlocks — frontend-only checks are that fragile",
      "In Attack Mode, the API trusts whatever role you claim",
    ],
    secure: [
      "Select 'guest' role and try 'Delete Record' — server returns 403 Forbidden",
      "Even if you fake the role header, the server decodes your JWT and rejects it",
      "Switch to 'admin' role — delete and manage actions are now allowed by the server",
      "The role comes from a signed token the server issued — you cannot forge it",
    ],
  },
  devtools: {
    attack: [
      'Click "Simulate Bypass" to see what an attacker types in DevTools',
      "Watch the purchase limit jump from $500 to $9,999",
      "The Premium Feature unlocks without any subscription check",
      'Try clicking "Inspect hidden field" — secrets in HTML are always exposed',
    ],
    secure: [
      "Try setting amount above $500 — the server rejects it regardless of the UI limit",
      "The premium feature check now happens server-side — JS cannot override it",
      "Notice the 'Simulate Bypass' button is disabled in Secure Mode",
      "Server validation is the only thing that actually enforces limits",
    ],
  },
};

export default function HintBar({ module }: { module: string }) {
  const { mode } = useSecurity();
  const [dismissed, setDismissed] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  const hints = MODULE_HINTS[module];
  if (!hints || dismissed) return null;

  const list = mode === "attack" ? hints.attack : hints.secure;
  const hint = list[hintIndex % list.length];

  return (
    <div className={clsx(
      "flex items-start gap-3 border rounded-xl px-4 py-3 text-xs font-mono transition-all",
      mode === "attack"
        ? "border-orange-500/20 bg-orange-950/10 text-orange-300"
        : "border-cyan-500/20 bg-cyan-950/10 text-cyan-300"
    )}>
      <Lightbulb size={13} className="mt-0.5 shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <span className={clsx(
          "text-[10px] font-bold uppercase tracking-widest mr-2",
          mode === "attack" ? "text-orange-400" : "text-cyan-400"
        )}>
          Try this:
        </span>
        <span className="text-zinc-400">{hint}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setHintIndex((i) => (i + 1) % list.length)}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
          title="Next hint"
        >
          <ChevronRight size={13} />
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-700 hover:text-zinc-500 transition-colors"
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
