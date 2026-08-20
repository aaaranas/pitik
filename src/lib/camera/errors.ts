/**
 * Camera failures, translated.
 *
 * `getUserMedia` rejects with DOMExceptions whose names are meaningful to
 * browser engineers and to nobody else. Every one of them reaches a person
 * standing in a bar trying to take a photo of their friends, so each gets a
 * plain sentence and, where one exists, something they can actually do.
 */

export type CameraErrorCode =
  | "denied"
  | "not-found"
  | "in-use"
  | "insecure"
  | "unsupported"
  | "overconstrained"
  | "unknown";

export class CameraError extends Error {
  readonly code: CameraErrorCode;
  /** The one thing the user can try. Omitted when there genuinely isn't one. */
  readonly remedy: string | null;

  constructor(code: CameraErrorCode, message: string, remedy: string | null = null) {
    super(message);
    this.name = "CameraError";
    this.code = code;
    this.remedy = remedy;
  }
}

export function toCameraError(error: unknown): CameraError {
  if (error instanceof CameraError) return error;

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return new CameraError(
      "insecure",
      "Cameras only work over a secure connection.",
      "Open Pitik over https:// and try again.",
    );
  }

  const name = error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return new CameraError(
        "denied",
        "Pitik doesn't have permission to use the camera.",
        "Allow camera access in your browser's site settings, then reload.",
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new CameraError(
        "not-found",
        "No camera was found on this device.",
        "You can still import photos from your gallery.",
      );
    case "NotReadableError":
    case "TrackStartError":
      return new CameraError(
        "in-use",
        "Something else is already using the camera.",
        "Close other camera apps or tabs, then try again.",
      );
    case "OverconstrainedError":
      return new CameraError(
        "overconstrained",
        "This camera can't shoot at the requested quality.",
        "Pitik will retry at a lower resolution.",
      );
    default:
      break;
  }

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return new CameraError(
      "unsupported",
      "This browser can't open a camera.",
      "Try Safari on iOS, or Chrome on Android and desktop.",
    );
  }

  return new CameraError(
    "unknown",
    "The camera didn't start.",
    "Reload the page and try again.",
  );
}
