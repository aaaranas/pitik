import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Relative time for roll cards — "Tonight" and "Yesterday" carry more feeling
 * than a date, and that is the point of the surface they appear on.
 */
export function relativeDay(timestamp: number, now = Date.now()): string {
  const then = new Date(timestamp);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dayMs = 86_400_000;
  const days = Math.floor((startOfToday - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / dayMs);

  if (days === 0) return then.getHours() >= 17 ? "Tonight" : "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 365) {
    return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }
  return then.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/** Countdown copy for a disposable roll that hasn't developed yet. */
export function formatTimeUntil(target: number, now = Date.now()): string {
  const remaining = target - now;
  if (remaining <= 0) return "ready now";
  const hours = Math.floor(remaining / 3_600_000);
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return `in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (hours >= 1) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const minutes = Math.max(1, Math.round(remaining / 60_000));
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "roll";
}
