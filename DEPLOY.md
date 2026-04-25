# FrontGuard — Deployment Guide

This guide covers deploying FrontGuard to **Vercel** (recommended) and **Netlify**.

---

## Option A: Deploy to Vercel (Recommended — 5 minutes)

Vercel is built by the Next.js team. Zero configuration needed.

### Step 1 — Push to GitHub

```bash
cd securitysystemapp
git init
git add .
git commit -m "feat: initial FrontGuard build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/frontguard.git
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (free account is fine)
2. Click **"Add New Project"**
3. Click **"Import Git Repository"** → select your `frontguard` repo
4. Vercel auto-detects Next.js — no settings to change
5. Click **"Deploy"**

That's it. Vercel will build and deploy in ~60 seconds.

### Step 3 — Get your live URL

Vercel gives you a URL like:
```
https://frontguard-yourname.vercel.app
```

Every future `git push` to `main` triggers an automatic redeploy.

### Environment Variables (optional)

FrontGuard requires no environment variables. If you extend the app later:

1. Go to your project → **Settings → Environment Variables**
2. Add variables as needed
3. Redeploy

---

## Option B: Deploy to Netlify

### Step 1 — Add a netlify.toml

Create this file in your project root:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Install the Netlify Next.js plugin:

```bash
npm install -D @netlify/plugin-nextjs
```

### Step 2 — Push to GitHub (same as above)

### Step 3 — Import to Netlify

1. Go to [netlify.com](https://netlify.com) → **"Add new site"** → **"Import from Git"**
2. Select your repo
3. Build command: `npm run build`
4. Publish directory: `.next`
5. Click **"Deploy site"**

---

## Option C: Run Locally

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/frontguard.git
cd frontguard

# Install dependencies
npm install

# Start dev server
npm run dev

# Open in browser
open http://localhost:3000
```

For a production build locally:

```bash
npm run build
npm start
```

---

## Security Headers

`vercel.json` and `next.config.ts` both apply these security headers to all routes:

| Header | Value | Purpose |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevents clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=()...` | Disables unused browser APIs |

---

## Sharing the App

Once deployed, share these URLs:

| Page | Purpose |
|---|---|
| `/landing` | Public marketing page — share this with anyone |
| `/` | App dashboard — links to all modules |
| `/xss` | XSS playground (start here) |
| `/auth` | Auth token simulation |
| `/api-security` | API security demo |
| `/rbac` | RBAC demo |
| `/devtools` | DevTools bypass demo |

---

## Portfolio Usage Tips

- Add the live Vercel URL to your resume and LinkedIn
- Screenshot the landing page for your portfolio site
- In interviews, walk through the XSS module — it's the most visually dramatic
- The RBAC module is great for explaining frontend vs backend security tradeoffs

---

## Troubleshooting

**Build fails on Vercel?**
- Make sure `node_modules` is in `.gitignore`
- Run `npm run build` locally first to catch errors

**Fonts not loading?**
- The app loads JetBrains Mono and Syne from Google Fonts via `<link>` tags
- If offline, the system monospace font is the fallback — it still looks fine

**API routes returning 404?**
- Vercel and Netlify both support Next.js API routes automatically
- Make sure you're not on a static export (`output: 'export'`) — the API routes require server-side rendering

---

Built by Zoriah Cocio · [info@zoriahcocio.com](mailto:info@zoriahcocio.com)
