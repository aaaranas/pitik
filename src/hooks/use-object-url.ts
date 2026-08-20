"use client";

import { useEffect, useMemo } from "react";

/**
 * Turns a Blob into an object URL and revokes it on change or unmount.
 *
 * This hook is the single reason the gallery can hold hundreds of photos
 * without the tab being killed: every `createObjectURL` pins its blob in memory
 * until revoked, and a camera app leaks megabytes per leak, not kilobytes.
 * Nothing in the app should call `createObjectURL` for render purposes directly.
 *
 * The URL is derived in a memo rather than held in state so the first paint
 * already has it — a photo that appears one frame late reads as a flicker when
 * you're scrolling a contact sheet.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}

/** The list form. Revokes the whole previous batch whenever the input changes. */
export function useObjectUrls(blobs: (Blob | null | undefined)[]): (string | null)[] {
  // Depends on array identity: callers memoise their lists, and comparing
  // blob-by-blob would cost more than the churn it saves.
  const urls = useMemo(
    () => blobs.map((blob) => (blob ? URL.createObjectURL(blob) : null)),
    [blobs],
  );

  useEffect(() => {
    return () => {
      for (const url of urls) if (url) URL.revokeObjectURL(url);
    };
  }, [urls]);

  return urls;
}
