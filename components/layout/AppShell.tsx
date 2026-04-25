"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { SecurityProvider } from "@/lib/store/SecurityContext";
import OnboardingModal from "@/components/ui/OnboardingModal";
import PWAProvider from "@/components/PWAProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SecurityProvider>
      <PWAProvider />
      <OnboardingModal />
      <div className="flex min-h-screen min-h-dvh">
        <Sidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 w-full">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SecurityProvider>
  );
}
