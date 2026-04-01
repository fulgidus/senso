import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useOnlineStatus } from "./useOnlineStatus"

describe("useOnlineStatus", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns true when navigator.onLine is true", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it("returns false when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it("updates when offline event fires", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true })
      window.dispatchEvent(new Event("offline"))
    })
    expect(result.current).toBe(false)
  })
})
