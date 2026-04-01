import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { BalanceMask } from "./BalanceMask"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "it" },
  }),
}))

describe("BalanceMask", () => {
  it("shows actual value when not masked", () => {
    render(<BalanceMask value="€1.234" masked={false} />)
    expect(screen.getByText("€1.234")).toBeDefined()
  })

  it("shows **** when masked", () => {
    render(<BalanceMask value="€1.234" masked={true} />)
    expect(screen.getByText("****")).toBeDefined()
    expect(screen.queryByText("€1.234")).toBeNull()
  })

  it("has aria-label when masked", () => {
    render(<BalanceMask value="€1.234" masked={true} />)
    const masked = screen.getByText("****")
    expect(masked.getAttribute("aria-label")).toBe("accessibility.balanceHidden")
  })
})
