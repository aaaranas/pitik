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
      className="mx-auto w-full max-w-2xl px-4 pb-10"
      style={{ paddingTop: "calc(var(--safe-top) + 1.5rem)" }}
    >
      <header>
        <h1 className="font-display text-4xl leading-none text-paper">Choose a booth</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-300">
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
              "shrink-0 rounded-full px-3 py-1.5 text-xs transition",
              category === name
                ? "bg-paper text-ink-900"
                : "bg-ink-900 text-ink-300 hover:bg-ink-800",
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
              className="group block rounded-xl p-2 transition-colors hover:bg-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-safelight-400"
            >
              {/* Fixed-height stage so every layout is shown at a comparable
                  size and the cards line up regardless of proportion. */}
              <div className="flex h-44 items-end justify-center">
                <TemplateThumb
                  template={template}
                  className="transition-transform duration-200 group-hover:-translate-y-0.5"
                />
              </div>
              <div className="mt-3">
                <p className="flex items-center gap-1 text-sm font-medium text-ink-100">
                  {template.name}
                  <ChevronRight
                    className="size-3.5 text-ink-500 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </p>
                <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ink-500">
                  {formatCount(template.shots, "shot")} · {template.category}
                </p>
                <p className="mt-1 text-xs leading-snug text-ink-400">{template.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
