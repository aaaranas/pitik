"use client";

import { useEffect, useState } from "react";

interface IOSDeviceOrientationEvent {
  requestPermission?: () => Promise<PermissionState>;
}

/**
 * Device roll in degrees, for the horizon indicator.
 *
 * Returns `null` whenever tilt is genuinely unknown — no sensor, no permission,
 * or a browser that doesn't ship the event. The level indicator keys off that
 * to hide itself entirely rather than displaying a line that never moves, which
 * would be worse than no level at all.
 *
 * iOS gates this behind a user gesture, so `enabled` should only be flipped on
 * from something the user did.
 */
export function useDeviceRoll(enabled: boolean): number | null {
  const [roll, setRoll] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      return;
    }

    let active = true;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (!active || event.gamma === null) return;
      // Smoothed: raw accelerometer output jitters by a degree or two at rest
      // and an unsmoothed indicator looks broken.
      setRoll((previous) => {
        const next = event.gamma!;
        return previous === null ? next : previous * 0.8 + next * 0.2;
      });
    };

    const attach = () => window.addEventListener("deviceorientation", onOrientation);

    const ctor = window.DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent;
    if (typeof ctor.requestPermission === "function") {
      ctor
        .requestPermission()
        .then((state) => {
          if (active && state === "granted") attach();
        })
        .catch(() => undefined);
    } else {
      attach();
    }

    return () => {
      active = false;
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [enabled]);

  // Gated on read rather than cleared on disable, so turning the level off
  // doesn't need a state write just to hide a line.
  return enabled ? roll : null;
}
