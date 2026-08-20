import "@testing-library/jest-dom/vitest";

/**
 * jsdom has no canvas, no MediaDevices, and no object-URL implementation worth
 * the name. Rather than pull in a canvas polyfill, the unit suite targets the
 * pure layers — colour maths, layout geometry, formatting, the repository — and
 * stubs only what component tests genuinely touch.
 */

if (typeof URL.createObjectURL === "undefined") {
  let counter = 0;
  Object.defineProperty(URL, "createObjectURL", {
    writable: true,
    value: () => `blob:pitik/${++counter}`,
  });
  Object.defineProperty(URL, "revokeObjectURL", { writable: true, value: () => {} });
}

if (typeof globalThis.matchMedia === "undefined") {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
