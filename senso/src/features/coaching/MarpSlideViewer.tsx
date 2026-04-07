/**
 * MarpSlideViewer - renders a MARP markdown slide deck inline in chat.
 *
 * Uses @marp-team/marp-core for accurate MARP rendering:
 * - Respects `theme: senso`, `class: lead`, `paginate:` and all MARP directives
 * - Inline SVG mode scales slides natively to any 16:9 container
 * - Single `senso` theme adapts to light/dark via CSS custom properties automatically
 * - Fullscreen via ReactDOM.createPortal (Phase 17-02)
 */

import { useState, useEffect, useRef } from "react"
import { Marp } from "@marp-team/marp-core"
import { SLIDE_INDEX } from "@/content/slideIndex"
import SENSO_THEME_CSS from "@/styles/marp-senso-theme.css?raw"

// ── Marp singleton ────────────────────────────────────────────────────────────
// Created once at module load; reused for all renders (render() is stateless).
let _marp: Marp | null = null
function getMarp(): Marp {
  if (_marp) return _marp
  _marp = new Marp({
    script: false,  // Don't inject browser polyfill script into HTML output
    math: "katex",  // KaTeX is lighter than MathJax; needed for $$...$$ in slides
    emoji: { shortcode: false, unicode: false },
  })
  _marp.themeSet.add(SENSO_THEME_CSS)
  return _marp
}

interface MarpSlideViewerProps {
  slideId: string
  title: string
}

export function MarpSlideViewer({ slideId, title }: MarpSlideViewerProps) {
  const raw = SLIDE_INDEX[slideId]
  const [current, setCurrent] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset to slide 0 when deck changes
  useEffect(() => {
    setCurrent(0)
  }, [slideId])

  // Focus container on mount for keyboard nav
  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  if (!raw) {
    return (
      <div className="border border-border rounded-md px-3 py-2 bg-background text-sm text-muted-foreground">
        {title}
      </div>
    )
  }

  // Render the full deck; htmlAsArray gives one SVG string per slide
  const marp = getMarp()
  const { html: slideHtmlArray, css } = marp.render(raw, { htmlAsArray: true } as never)
  const slides = slideHtmlArray as string[]
  const total = slides.length

  const prev = () => setCurrent((c) => Math.max(0, c - 1))
  const next = () => setCurrent((c) => Math.min(total - 1, c + 1))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next() }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev() }
    if (e.key === "Escape") setFullscreen(false)
    if (e.key === "f" || e.key === "F") setFullscreen((v) => !v)
  }

  // Inject MARP's scoped CSS into <head>; clean up on unmount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const style = document.createElement("style")
    style.setAttribute("data-marp-viewer", slideId)
    style.textContent = css
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [slideId, css])

  // Inline viewer: fixed 16:9 aspect ratio, max 640px wide
  // The <div class="marpit"> wrapper is required for MARP's CSS scoping to apply
  const slideCanvas = (
    <div
      // marpit class is MARP's default container - CSS selectors are scoped to it
      className="marpit"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: slides[current] ?? "" }}
    />
  )

  const viewer = (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`marp-viewer ${fullscreen ? "marp-fullscreen" : "marp-inline"}`}
      aria-label={`Slide deck: ${title}`}
    >
      {/* 16:9 slide canvas - SVG inside scales natively via viewBox */}
      <div className="marp-slide-canvas">
        {slideCanvas}
      </div>

      {/* Navigation bar */}
      <div className="marp-nav">
        <button
          onClick={prev}
          disabled={current === 0}
          className="marp-nav-btn"
          aria-label="Slide precedente"
        >
          ‹
        </button>
        <span className="marp-nav-counter">
          {current + 1} / {total}
        </span>
        <button
          onClick={next}
          disabled={current === total - 1}
          className="marp-nav-btn"
          aria-label="Slide successiva"
        >
          ›
        </button>
        <button
          onClick={() => setFullscreen((v) => !v)}
          className="marp-nav-btn marp-fullscreen-btn"
          aria-label={fullscreen ? "Esci da schermo intero" : "Schermo intero"}
        >
          {fullscreen ? "⊠" : "⊞"}
        </button>
      </div>
    </div>
  )

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      <div className="px-3 py-2 bg-muted/50 font-semibold text-sm flex items-center justify-between">
        <span>{title}</span>
        <span className="text-xs text-muted-foreground font-normal">{total} slide</span>
      </div>
      {viewer}
    </div>
  )
}
