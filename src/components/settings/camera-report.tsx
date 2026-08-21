"use client";

import { useEffect, useState } from "react";
import { findUltraWide, listCameras } from "@/lib/camera/service";

/**
 * What this device actually reports about its cameras.
 *
 * Lens detection depends on vendor labels, and vendors are wildly inconsistent
 * about them. When 0.5x fails to appear the only way to find out why is to see
 * the raw list — so it lives here rather than in a console nobody opens.
 *
 * Labels are blank until camera permission has been granted, which is itself
 * worth showing: an empty list is information, not a bug.
 */
export function CameraReport() {
  const [labels, setLabels] = useState<string[] | null>(null);
  const [ultraWide, setUltraWide] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cameras = await listCameras();
        if (cancelled) return;
        setLabels(cameras.map((device) => device.label || "(unnamed)"));
        setUltraWide(findUltraWide(cameras, "environment")?.label ?? null);
      } catch {
        if (!cancelled) setLabels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-4 py-3.5">
      <p className="text-sm text-ink-100">Cameras on this device</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-400">
        {ultraWide
          ? `Ultra-wide found: ${ultraWide}. The 0.5x control is available.`
          : "No ultra-wide lens was found, so the 0.5x control is hidden."}
      </p>

      {labels === null ? (
        <p className="mt-2 font-mono text-[0.6875rem] text-ink-600">Checking…</p>
      ) : labels.length === 0 ? (
        <p className="mt-2 font-mono text-[0.6875rem] text-ink-600">
          None reported. Open the camera once, then come back — labels stay blank
          until permission is granted.
        </p>
      ) : (
        <ul className="mt-2 space-y-0.5">
          {labels.map((label, index) => (
            <li key={`${label}-${index}`} className="font-mono text-[0.6875rem] text-ink-500">
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
