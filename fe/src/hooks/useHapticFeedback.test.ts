import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderHook } from "@testing-library/react";
import { useHapticFeedback } from "./useHapticFeedback";

describe("useHapticFeedback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls navigator.vibrate when available", () => {
    const vibrateMock = vi.fn();
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => useHapticFeedback());
    result.current.tap();
    expect(vibrateMock).toHaveBeenCalledWith(10);
  });

  it("does not throw when navigator.vibrate is unavailable", () => {
    const nav = navigator as unknown as Record<string, unknown>;
    delete nav.vibrate;
    const { result } = renderHook(() => useHapticFeedback());
    expect(() => result.current.tap()).not.toThrow();
  });
});
