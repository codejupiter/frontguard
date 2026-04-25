"use client";

import { useEffect } from "react";

export default function PWAProvider() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let updateTimer: ReturnType<typeof setInterval> | undefined;

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          console.log("SW registered:", reg.scope);

          // Check for updates every 60 seconds
          updateTimer = setInterval(() => reg.update(), 60_000);

          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New content is available — in prod, show a toast/banner
                console.log("SW: new version available. Reload to update.");
              }
            });
          });
        })
        .catch((err) => console.warn("SW registration failed:", err));
    };

    window.addEventListener("load", registerServiceWorker);

    return () => {
      window.removeEventListener("load", registerServiceWorker);
      if (updateTimer) clearInterval(updateTimer);
    };
  }, []);

  return null; // Renders nothing — just registers the SW
}
