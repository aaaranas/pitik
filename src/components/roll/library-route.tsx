"use client";

import { Suspense } from "react";
import { LibraryScreen } from "./library-screen";

export function LibraryRoute() {
  return (
    // `useSearchParams` needs a boundary to keep the route statically
    // renderable; the tab lives in the URL so links can land on a shelf.
    <Suspense fallback={<div className="h-full bg-ink-950" />}>
      <LibraryScreen />
    </Suspense>
  );
}
