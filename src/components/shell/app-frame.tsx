"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { TabBar } from "./tab-bar";
import { OfflineBanner } from "./offline-banner";
import { SyncProvider } from "@/components/providers/sync-provider";

/**
 * The outer shell.
 *
 * Owns two things nothing else should: the true viewport height, and whether
 * the tab bar is on screen. Immersive surfaces — the viewfinder, a running
 * booth sequence — take the whole display; everything else sits above the nav.
 */

/** Routes that own the entire screen. */
const IMMERSIVE = ["/camera", "/booth/run"];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersive = IMMERSIVE.some((route) => pathname.startsWith(route));

  useEffect(() => {
    // `100dvh` covers modern browsers, but iOS standalone still reports a
    // viewport that includes the home indicator area. Measuring once per resize
    // is cheap and keeps the shutter off the bottom edge everywhere.
    const setHeight = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.visualViewport?.height ?? window.innerHeight}px`,
      );
    };
    setHeight();
    // Marks the point React has taken over. Read by the end-to-end suite, which
    // can otherwise click a server-rendered button before any handler exists.
    document.documentElement.dataset.hydrated = "true";
    window.addEventListener("resize", setHeight);
    window.visualViewport?.addEventListener("resize", setHeight);
    return () => {
      window.removeEventListener("resize", setHeight);
      window.visualViewport?.removeEventListener("resize", setHeight);
    };
  }, []);

  return (
    <div
      className="relative flex flex-col overflow-hidden bg-ink-950"
      style={{ height: "var(--app-height)" }}
    >
      <SyncProvider />
      <OfflineBanner />
      <main
        id="main"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={immersive ? { overflow: "hidden" } : undefined}
      >
        {children}
      </main>
      {immersive ? null : <TabBar />}
    </div>
  );
}
