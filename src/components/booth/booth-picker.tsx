"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TemplateThumb } from "./template-thumb";
import { BOOTH_TEMPLATES, listTemplateCategories } from "@/lib/booth/templates";
import { formatCount } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Choose a booth.
 *
 * Templates are shown as objects, at their true proportions, grouped by the
 * occasion you'd reach for them. The number of shots is stated up front because
 * that's the one thing that changes what the next two minutes look like.
 */
export function BoothPicker() {
  const categories = useMemo(() => ["All", ...listTemplateCategories()], []);
  const [category, setCategory] = useState("All");

  const templates =
    category === "All"
      ? BOOTH_TEMPLATES
      : BOOTH_TEMPLATES.filter((template) => template.category === category);

  return (
    <div
      className="mx-auto min-h-full w-full max-w-2xl bg-cream-50 px-4 pb-10"
      style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}
    >
      <header>
        <span className="blk">Booth</span>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-none tracking-[-0.04em] text-cocoa-900">
          Choose a booth
        </h1>
        <div className="rule-ink mt-2" aria-hidden />
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-cocoa-600">
          Pick a layout, line everyone up, and let it count you in. The strip prints
          itself when the last shot lands.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Booth categories"
        className="-mx-4 mt-6 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={category === name}
            onClick={() => setCategory(name)}
            className={cn(
              "shrink-0 rounded-slab border-2 border-cocoa-900 px-3 py-1.5 text-xs font-medium transition",
              // A lit control reads darker on a pale ground, never brighter.
              category === name
                ? "bg-cocoa-900 text-cream-50"
                : "bg-cream-50 text-cocoa-900 hover:bg-cream-200",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {templates.map((template) => (
          <li key={template.id}>
            <Link
              href={`/booth/run?template=${template.id}`}
              className="squish slab group block p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-deep"
            >
              {/* Fixed-height stage so every layout is shown at a comparable
                  size and the cards line up regardless of proportion. */}
              <div className="flex h-40 items-end justify-center">
                <TemplateThumb
                  template={template}
                  className="transition-transform duration-200 group-hover:-translate-y-0.5"
                />
              </div>
              <div className="mt-3">
                <p className="flex items-center gap-1 font-display text-sm font-semibold tracking-[-0.01em] text-cocoa-900">
                  {template.name}
                  <ChevronRight
                    className="size-3.5 text-cocoa-600 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </p>
                <p className="counter mt-1">
                  {formatCount(template.shots, "shot")} · {template.category}
                </p>
                <p className="mt-1 text-xs leading-snug text-cocoa-600">{template.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
