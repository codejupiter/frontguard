import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Syne } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FrontGuard — Frontend Security Playground",
  description: "Interactive frontend security vulnerability demonstrations. Learn XSS, Auth flaws, API security, RBAC, and DevTools bypasses hands-on.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FrontGuard",
  },
  icons: {
    icon: [
      { url: "/icons/icon-96x96.png",   sizes: "96x96",   type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#080810",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();

  return (
    <html lang="en" className={`${jetBrainsMono.variable} ${syne.variable}`}>
      <body
        className="bg-[#080810] text-white antialiased"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
