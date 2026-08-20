"use client";

import { CloudOff } from "lucide-react";
import { useMounted, useOnline } from "@/hooks/use-online";

/**
 * Offline notice.
 *
 * Worded as reassurance, not an error, because nothing is actually broken:
 * every camera, filter, booth, and gallery feature works with the radio off.
 * The only thing offline changes is whether sync has run yet.
 */
export function OfflineBanner() {
  const online = useOnline();
  const mounted = useMounted();

  if (!mounted || online) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 bg-ink-800 px-4 py-1.5 text-xs text-ink-200"
      style={{ paddingTop: "calc(var(--safe-top) + 0.375rem)" }}
    >
      <CloudOff className="size-3.5 shrink-0" aria-hidden />
      <span>Offline — the camera still works. Photos are saved on this device.</span>
    </div>
  );
}
