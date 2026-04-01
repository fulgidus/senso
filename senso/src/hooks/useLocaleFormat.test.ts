import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "it" },
    t: (key: string) => key,
  }),
}))

import { useLocaleFormat } from "./useLocaleFormat"

describe("useLocaleFormat", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("formats currency with Italian locale", () => {
    const { result } = renderHook(() => useLocaleFormat())
    const formatted = result.current.currency(1234)
    // Contains the digits (locale-specific separators vary by ICU data availability)
    expect(formatted).toMatch(/1.?234/)
    expect(formatted).toContain("€")
  })

  it("formats number with Italian locale", () => {
    const { result } = renderHook(() => useLocaleFormat())
    const formatted = result.current.number(1234567)
    // Contains digits (locale-specific separators vary by ICU data availability)
    expect(formatted).toMatch(/1.?234.?567/)
  })

  it("formats date with Italian locale", () => {
    const { result } = renderHook(() => useLocaleFormat())
    const formatted = result.current.date("2026-01-15")
    // Italian date format: 15/1/2026 or similar
    expect(formatted).toContain("15")
  })
})
