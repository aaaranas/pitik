"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons.
 *
 * Sized around thumbs first — the smallest variant still clears the 44px
 * touch target once padding is counted, because every one of these can end up
 * on a camera screen being tapped one-handed in the dark.
 */
const buttonVariants = cva(
  "squish inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        // A pastel fill demands dark ink — white on sky is 1.7:1.
        primary:
          "bg-sky-base text-cocoa-900 hover:bg-sky-base/85 shadow-[0_2px_8px_color-mix(in_srgb,var(--color-sky-deep)_22%,transparent)]",
        soft: "bg-cream-50 text-cocoa-900 hover:bg-white hairline",
        subtle: "bg-cream-200 text-cocoa-800 hover:bg-cream-300",
        outline: "border border-edge-strong text-cocoa-800 hover:bg-cream-100",
        ghost: "text-cocoa-600 hover:bg-cream-200 hover:text-cocoa-900",
        danger: "bg-blush-tint text-blush-deep hover:bg-blush-base/60",
      },
      size: {
        sm: "h-9 rounded-pill px-3.5 text-[0.8125rem]",
        md: "h-11 rounded-pill px-5 text-sm",
        lg: "h-14 rounded-pill px-7 text-base",
        icon: "size-11 rounded-pill",
        "icon-sm": "size-9 rounded-pill",
      },
    },
    defaultVariants: { variant: "subtle", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      // Buttons inside forms default to submit, which has caused an accidental
      // submit in every codebase that forgot it.
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
