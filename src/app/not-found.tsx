import Link from "next/link";
import { PitikMark } from "@/components/shell/wordmark";

export default function NotFound() {
  return (
    <div className="grid min-h-full place-items-center bg-cream-50 px-6 text-center">
      <div className="max-w-xs">
        <PitikMark className="mx-auto size-8 text-cocoa-900" />
        <h1 className="mt-5 font-display text-3xl text-cocoa-900">Nothing here</h1>
        <p className="mt-3 text-sm leading-relaxed text-cocoa-600">
          This frame came back blank. It happens.
        </p>
        <Link
          href="/"
          className="squish mt-7 inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-sky-base px-7 text-base font-semibold text-cocoa-900 shadow-[0_2px_8px_color-mix(in_srgb,var(--color-sky-deep)_22%,transparent)] hover:bg-sky-base/85"
        >
          Back to your rolls
        </Link>
      </div>
    </div>
  );
}
