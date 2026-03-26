import "@testing-library/jest-dom/vitest";

// Polyfill ResizeObserver for Radix UI components (not in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
