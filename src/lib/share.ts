/**
 * Sharing and saving.
 *
 * The Web Share API is the good path on phones — it hands the file to the
 * user's own apps without Pitik ever seeing it. Everything else falls back to a
 * download, and on iOS Safari (which blocks programmatic downloads of blobs in
 * standalone mode) to opening the image in a new tab so it can be long-pressed.
 */

export type ShareOutcome = "shared" | "downloaded" | "opened" | "cancelled" | "failed";

function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files })
  );
}

export function extensionFor(blob: Blob): string {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  return "jpg";
}

export function downloadBlob(blob: Blob, filename: string): ShareOutcome {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoked late: Safari cancels an in-flight download if the URL dies first.
    setTimeout(() => URL.revokeObjectURL(url), 20_000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

export async function shareImage(options: {
  blob: Blob;
  filename: string;
  title?: string;
  text?: string;
}): Promise<ShareOutcome> {
  const file = new File([options.blob], options.filename, { type: options.blob.type });

  if (canShareFiles([file])) {
    try {
      await navigator.share({ files: [file], title: options.title, text: options.text });
      return "shared";
    } catch (error) {
      // The user backing out of the share sheet is not an error worth surfacing.
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }

  return downloadBlob(options.blob, options.filename);
}

export async function shareLink(options: {
  url: string;
  title?: string;
  text?: string;
}): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ url: options.url, title: options.title, text: options.text });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(options.url);
      return "opened";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
