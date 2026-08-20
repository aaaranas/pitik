"use client";

import { useEffect, useState } from "react";
import { exportStrip } from "@/lib/booth/compositor";
import { BOOTH_TEMPLATES } from "@/lib/booth/templates";
import { DEFAULT_STRIP_STYLE } from "@/lib/booth/types";
import { drawReferenceImage } from "@/lib/dev/reference-image";
import { canvasToBlob, renderCapture, type AnyCanvas } from "@/lib/filters/canvas";
import { toCssPreview } from "@/lib/filters/css";
import { resolveFilter } from "@/lib/filters/registry";
import { FILTER_PRESETS } from "@/lib/filters/presets";

interface Rendered {
  id: string;
  name: string;
  category: string;
  /** The export renderer's output. */
  exported: string;
  /** The same grade through the live-preview path, for comparison. */
  preview: { filter: string; layers: ReturnType<typeof toCssPreview>["layers"] };
}

/**
 * Renders every filter twice — once through the full canvas pipeline and once
 * through the CSS preview approximation — and shows them side by side.
 *
 * The two are allowed to differ (CSS cannot do spatial effects), but they must
 * not *disagree*: if a preset looks warm in the viewfinder and cool in the
 * saved photo, that shows up here immediately.
 */
export function RenderCheck() {
  const [source, setSource] = useState<string | null>(null);
  const [filters, setFilters] = useState<Rendered[]>([]);
  const [strips, setStrips] = useState<{ name: string; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let urls: string[] = [];

    void (async () => {
      try {
        const reference = drawReferenceImage();
        urls.push(URL.createObjectURL(await canvasToBlob(reference as AnyCanvas, "image/png")));
        setSource(urls[0]);

        const bitmap = await createImageBitmap(reference as ImageBitmapSource);

        const rendered: Rendered[] = [];
        for (const preset of FILTER_PRESETS) {
          const filter = resolveFilter(preset.id);
          const canvas = renderCapture(bitmap, {
            adjustments: filter.adjustments,
            aspect: 4 / 3,
            maxDimension: 640,
            seed: 7,
          });
          const url = URL.createObjectURL(await canvasToBlob(canvas, "image/jpeg", 0.9));
          urls.push(url);
          rendered.push({
            id: preset.id,
            name: preset.name,
            category: preset.category,
            exported: url,
            preview: toCssPreview(filter.adjustments),
          });
        }
        setFilters(rendered);

        const frames = Array.from({ length: 9 }, () => bitmap as CanvasImageSource);
        const composed: { name: string; url: string }[] = [];
        for (const template of BOOTH_TEMPLATES) {
          const { blob } = await exportStrip({
            template,
            frames: frames.slice(0, template.shots),
            style: { ...DEFAULT_STRIP_STYLE, paper: template.defaultPaper, caption: "test strip" },
            scale: 0.5,
          });
          const url = URL.createObjectURL(blob);
          urls.push(url);
          composed.push({ name: template.name, url });
        }
        setStrips(composed);
        bitmap.close();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();

    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl text-paper">Render check</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-400">
        Every filter through the export renderer (left of each pair) and the live
        preview approximation (right). They should read as the same look. Development
        only.
      </p>

      {error ? (
        <p className="mt-6 rounded-lg bg-signal-bad/15 p-4 text-sm text-signal-bad">
          Pipeline failed: {error}
        </p>
      ) : null}

      {source ? (
        <section className="mt-8">
          <h2 className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-400">
            Reference image
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={source} alt="Reference" className="mt-2 w-72 rounded" />
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-400">
          Filters ({filters.length})
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filters.map((filter) => (
            <figure key={filter.id} data-testid="filter-sample">
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded bg-ink-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={filter.exported} alt={`${filter.name}, exported`} />
                <span className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={source ?? ""}
                    alt={`${filter.name}, live preview`}
                    style={{ filter: filter.preview.filter }}
                    className="size-full object-cover"
                  />
                  {filter.preview.layers.map((layer, index) => (
                    <span
                      key={index}
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: layer.background,
                        mixBlendMode: layer.blendMode as React.CSSProperties["mixBlendMode"],
                        opacity: layer.opacity,
                      }}
                    />
                  ))}
                </span>
              </div>
              <figcaption className="mt-1.5 text-xs text-ink-200">
                {filter.name}
                <span className="ml-1 text-ink-500">{filter.category}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-400">
          Booth templates ({strips.length})
        </h2>
        <div className="mt-3 flex flex-wrap items-start gap-6">
          {strips.map((strip) => (
            <figure key={strip.name} data-testid="strip-sample">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={strip.url} alt={strip.name} className="max-h-80 w-auto" />
              <figcaption className="mt-1.5 text-xs text-ink-200">{strip.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
