import { notFound } from "next/navigation";
import { RenderCheck } from "@/components/dev/render-check";

/**
 * Development-only visual check for the image pipeline.
 *
 * Runs every shipped filter and every booth template through the *real*
 * renderers against a generated reference image, so a regression in the colour
 * maths or the compositor is visible rather than theoretical. jsdom has no
 * canvas, so this is the only place the pixel path can actually be looked at.
 *
 * `notFound()` in production keeps it out of the shipped app entirely.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RenderCheck />;
}
