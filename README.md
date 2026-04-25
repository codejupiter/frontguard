# FrontGuard — Frontend Security Playground

> An interactive web application demonstrating common frontend security vulnerabilities and their secure implementations. Built as a production-quality portfolio project.

**Live Demo:** `https://frontguard-yourname.vercel.app` ← replace after deploying  
**Landing Page:** `/landing` · **App:** `/`

---

## Overview

FrontGuard lets developers **trigger real exploits in a safe sandbox** — then see exactly how to fix them. Every module has:

- ⚡ A live, interactive exploit you can actually execute
- 🛡️ A side-by-side secure implementation
- 📖 Educational context: what, why, fix, real-world cases
- 📋 Real-time security log with color-coded event types
- 💡 Beginner-friendly hints that update per mode

---

## Quick Start

```bash
npm install && npm run dev
# Open http://localhost:3000/landing
```

See [DEPLOY.md](./DEPLOY.md) for Vercel/Netlify deployment (5 minutes).

---

## Features

| | Feature | Description |
|---|---|---|
| 🌐 | **Landing Page** | Public marketing page at `/landing` with animated terminal, breach timeline, module overview |
| 🎓 | **Onboarding Tour** | 4-step guided modal on first visit. Reopenable via the `?` button |
| 💡 | **Hint Bar** | Contextual "try this" prompts per module per mode — great for first-timers |
| 🔴 | **Attack Mode** | Vulnerable implementations. Exploits actually execute |
| 🟢 | **Secure Mode** | Fixed implementations. Same exploit is neutralized |
| 📋 | **Security Log** | Real-time log panel on every page tracking exploits, blocks, requests, errors |

---

## Security Modules

### A · XSS Playground `/xss`
**Vulnerability:** Cross-Site Scripting via `innerHTML`

Attack Mode injects user input directly as `innerHTML` — any embedded `<script>` or event handler (`onerror`, `onclick`) executes in the browser. Secure Mode uses `textContent`, treating all input as plain text.

**Quick payload:** `<img src=x onerror="alert(document.cookie)">`

**Real cases:** MySpace Samy Worm (1M accounts, 2005), British Airways breach (500K payment cards, 2018)

---

### B · Auth Simulation `/auth`
**Vulnerability:** Storing JWTs in `localStorage`

After login, Attack Mode stores the token in `localStorage` — readable by any JS on the page including XSS payloads. A "Simulate XSS Token Theft" button demonstrates the attack. Secure Mode sets an `httpOnly` cookie that JavaScript cannot read at all.

**Try it:** Login as `admin / admin123`, open DevTools → Application → Local Storage

**Real cases:** Widespread in React SPAs; explicitly warned against in Auth0 documentation

---

### C · API Security `/api-security`
**Vulnerability:** Unauthenticated, unthrottled API endpoints

Attack Mode exposes a `/api/logs` endpoint with no auth required, returning full PII (SSN, salary). Secure Mode requires a Bearer token, strips sensitive fields, and enforces a rate limit of 3 req/10s.

**Try it:** Click "Simulate Spam" — in Attack Mode all 6 requests succeed; in Secure Mode you hit a 429 after 3

**Real cases:** LinkedIn (700M records, 2021), Facebook (533M records, 2021), Peloton (2021)

---

### D · RBAC Demo `/rbac`
**Vulnerability:** Frontend-only role checks

Attack Mode checks permissions in JavaScript — trivially bypassed by editing a variable in the console. Secure Mode encodes the role in a server-signed JWT; the server decodes and verifies it on every request. The client cannot forge it.

**Try it:** Select "guest", then try "Delete Record" — in Attack Mode you can bypass it in console

**Real cases:** Numerous HackerOne reports; healthcare portals with patient record exposure

---

### E · DevTools Bypass `/devtools`
**Vulnerability:** Business logic enforced only in the browser

Demonstrates raising purchase limits by editing HTML attributes, unlocking premium features via JS globals, and reading hidden field values. Secure Mode enforces all limits server-side regardless of what the client sends.

**Try it:** Click "Simulate Bypass" and watch the DevTools console commands unfold

**Real cases:** E-commerce price manipulation, game economy exploits, API key theft from HTML

---

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript (strict) |
| **Styling** | Tailwind CSS v4 |
| **Fonts** | JetBrains Mono + Syne |
| **Icons** | Lucide React |
| **State** | React Context API |
| **API** | Next.js Route Handlers |
| **Auth** | Manual JWT simulation (no external providers) |
| **Deploy** | Vercel (zero config) |

---

## Project Structure

```
securitysystemapp/
├── app/
│   ├── layout.tsx              # Root layout + onboarding modal
│   ├── page.tsx                # Dashboard with module grid
│   ├── landing/page.tsx        # Public marketing page
│   ├── xss/page.tsx            # XSS Playground
│   ├── auth/page.tsx           # Auth Simulation
│   ├── api-security/page.tsx   # API Security Demo
│   ├── rbac/page.tsx           # RBAC Demo
│   ├── devtools/page.tsx       # DevTools Bypass
│   └── api/
│       ├── auth/route.ts       # Mock login endpoint
│       ├── logs/route.ts       # Rate-limited data endpoint
│       └── rbac/route.ts       # Server-enforced RBAC
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navigation with mode-aware active states
│   │   ├── Topbar.tsx          # Mode toggle, help button, exploit counter
│   │   └── LogsPanel.tsx       # Real-time log viewer
│   └── ui/
│       ├── OnboardingModal.tsx # 4-step guided tour
│       ├── HintBar.tsx         # Contextual beginner hints
│       ├── InfoPanel.tsx       # What / Why / Fix / Real-world panel
│       └── primitives.tsx      # ModeCard, StatusBadge, SectionHeader
├── lib/
│   ├── store/SecurityContext.tsx  # Global state: mode, logs, current user
│   └── security/utils.ts          # sanitize, rateLimit, JWT, RBAC helpers
├── types/index.ts
├── vercel.json                 # Vercel deployment + security headers
└── DEPLOY.md                   # Deployment guide
```

---

## What I Learned

1. **The client is always untrusted** — anything in the browser can be modified by the user
2. **`localStorage` is not secure storage** — any JS on the page can read it, including XSS payloads
3. **`innerHTML` is dangerous with user input** — always use `textContent` or DOMPurify
4. **RBAC must be server-enforced** — client-side role checks are cosmetic, not security controls
5. **Rate limiting belongs at the API layer** — not the frontend
6. **`httpOnly` cookies are the right default** for auth tokens in web apps
7. **DevTools is a full runtime debugger** — never rely on hidden fields or JS flags for security
8. **Security headers add meaningful protection** — X-Frame-Options, CSP, X-Content-Type-Options all matter

---

## Author

**Zoriah Cocio** — Frontend Engineer  
[zoriahcocio.com](https://zoriahcocio.com) · [info@zoriahcocio.com](mailto:info@zoriahcocio.com)

---

MIT License — Educational and portfolio use.
