import { describe, it, expect } from "vitest"

// Use Vite's import.meta.glob to load all source files as raw strings.
// The glob excludes test files, the hook itself, and generated assets.
const sourceFiles = import.meta.glob(
  [
    "../**/*.tsx",
    "../**/*.ts",
    "!../**/*.test.ts",
    "!../**/*.test.tsx",
    "!../hooks/useLocaleFormat.ts",
    // These files use it-IT as a dynamic voice locale tag, not hardcoded formatting
    "!../features/coaching/useVoiceInput.ts",
    "!../features/coaching/useTTS.ts",
    "!../vite-env.d.ts",
  ],
  { as: "raw", eager: true }
)

describe("no hardcoded locale strings", () => {
  it("has source files to check", () => {
    expect(Object.keys(sourceFiles).length).toBeGreaterThan(0)
  })

  it('contains no hardcoded "it-IT" in source files', () => {
    const violations: string[] = []

    for (const [filePath, content] of Object.entries(sourceFiles)) {
      const lines = (content as string).split("\n")
      lines.forEach((line: string, i: number) => {
        if (line.includes('"it-IT"') || line.includes("'it-IT'")) {
          violations.push(`${filePath}:${i + 1}: ${line.trim()}`)
        }
      })
    }

    expect(violations).toEqual([])
  })
})
