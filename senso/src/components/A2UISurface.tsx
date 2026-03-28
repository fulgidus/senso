import { useRef, useEffect } from "react"
import "./a2ui-element" // registers <a2ui-surface> custom element
import type { A2UISurfaceElement } from "./a2ui-element"

interface A2UISurfaceProps {
  jsonl: string | null | undefined
}

export function A2UISurface({ jsonl }: A2UISurfaceProps) {
  const ref = useRef<A2UISurfaceElement>(null)

  useEffect(() => {
    if (ref.current) {
      // Set as DOM property (not attribute) so Lit picks it up reactively
      ref.current.jsonl = jsonl ?? null
    }
  }, [jsonl])

  if (!jsonl) return null

  return <a2ui-surface ref={ref as React.RefObject<HTMLElement>} />
}
