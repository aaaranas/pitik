"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BoothRunner } from "./booth-runner";
import { getTemplate } from "@/lib/booth/templates";

function BoothRouteInner() {
  const params = useSearchParams();
  // `getTemplate` falls back to the classic strip for an unknown or missing id,
  // so a stale bookmark opens a working booth rather than an error page.
  const template = getTemplate(params.get("template") ?? undefined);
  return <BoothRunner key={template.id} template={template} />;
}

export function BoothRoute() {
  return (
    <Suspense fallback={<div className="min-h-full bg-cream-50" />}>
      <BoothRouteInner />
    </Suspense>
  );
}
