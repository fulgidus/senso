import { useRef, useEffect } from "react"
import "./a2ui-element" // registers <a2ui-surface> custom element
import type { A2UISurfaceElement } from "./a2ui-element"

interface A2UISurfaceProps {
  jsonl: string | null | undefined
  onAction?: (action: string) => void
}

export function A2UISurface({ jsonl, onAction }: A2UISurfaceProps) {
  const ref = useRef<A2UISurfaceElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.jsonl = jsonl ?? null
    }
  }, [jsonl])

  useEffect(() => {
    const el = ref.current
    if (!el || !onAction) return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string }>).detail
      onAction(detail?.action ?? "")
    }
    el.addEventListener("a2ui-action", handler)
    return () => el.removeEventListener("a2ui-action", handler)
  }, [onAction])

  if (!jsonl) return null

  return <a2ui-surface ref={ref as React.RefObject<HTMLElement>} />
}
