"use client";

import { Aperture, Camera, Images, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/providers/session-provider";
import { cn } from "@/lib/utils";

/**
 * Bottom navigation.
 *
 * Four destinations, no more. The camera entry is weighted differently from
 * the others — it's the reason the app is open, so it reads as an action
 * rather than a place.
 */
const TABS = [
  { href: "/", label: "Home", icon: Aperture, match: (p: string) => p === "/" },
  { href: "/booth", label: "Booth", icon: LayoutGrid, match: (p: string) => p.startsWith("/booth") },
  { href: "/camera", label: "Camera", icon: Camera, match: (p: string) => p.startsWith("/camera") },
  { href: "/rolls", label: "Rolls", icon: Images, match: (p: string) => p.startsWith("/rolls") },
] as const;

export function TabBar() {
  const pathname = usePathname();
  const { activeRollId } = useSession();

  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-t-2 border-ink-800 bg-ink-950/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          // Keep shooting into the roll you're already on rather than starting
          // a new one every time the tab is tapped.
          const href =
            tab.href === "/camera" && activeRollId ? `/camera?roll=${activeRollId}` : tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 transition-colors",
                  active ? "text-safelight-400" : "text-ink-400 hover:text-ink-200",
                )}
              >
                <Icon className="size-5" aria-hidden strokeWidth={active ? 2.2 : 1.8} />
                <span className="font-mono text-[0.5625rem] uppercase tracking-[0.2em]">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
