import { Shield, WifiOff } from "lucide-react";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-6">
          <WifiOff size={28} className="text-zinc-500" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-4">
          <Shield size={16} className="text-emerald-400" />
          <span className="font-mono font-bold text-white">FrontGuard</span>
        </div>

        <h1 className="text-2xl font-black text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>
          You&apos;re offline
        </h1>
        <p className="text-zinc-500 text-sm leading-relaxed mb-8 font-mono">
          Some modules need a network connection for the API demos.
          Static pages and cached content are still available.
        </p>

        <div className="space-y-2">
          <Link
            href="/"
            className="block w-full py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-mono font-bold hover:bg-emerald-500/20 transition-all"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/xss"
            className="block w-full py-2.5 border border-zinc-800 text-zinc-400 rounded-xl text-sm font-mono hover:border-zinc-700 hover:text-zinc-300 transition-all"
          >
            XSS Playground (works offline)
          </Link>
        </div>

        <p className="text-zinc-700 text-[10px] font-mono mt-8">
          Reconnect to access API Security and Auth demos
        </p>
      </div>
    </div>
  );
}
