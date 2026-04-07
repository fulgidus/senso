/**
 * MarpSlideViewer - renders a MARP markdown slide deck inline in chat.
 *
 * Uses @marp-team/marp-core for accurate MARP rendering:
 * - Respects `theme: senso`, `class: lead`, `paginate:` and all MARP directives
 * - Inline SVG mode scales slides natively to any 16:9 container
 * - Single `senso` theme adapts to light/dark via CSS custom properties automatically
 * - Fullscreen via ReactDOM.createPortal into document.body
 */

import { useState, useEffect, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
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
  const inlineRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)

  // Reset to slide 0 when deck changes
  useEffect(() => {
    setCurrent(0)
  }, [slideId])

  // Focus inline container on mount for keyboard nav
  useEffect(() => {
    inlineRef.current?.focus()
  }, [])

  // Focus portal container when fullscreen opens
  useEffect(() => {
    if (fullscreen) {
      // Small delay to let portal mount
      requestAnimationFrame(() => portalRef.current?.focus())
    }
  }, [fullscreen])

  // Lock body scroll while fullscreen is open
  useEffect(() => {
    if (fullscreen) {
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [fullscreen])

  // Render the full deck; memoize to avoid re-rendering on every state change
  const { slides, css } = useMemo(() => {
    if (!raw) return { slides: [] as string[], css: "" }
    const marp = getMarp()
    const result = marp.render(raw, { htmlAsArray: true } as never)
    return { slides: result.html as string[], css: result.css }
  }, [raw])

  // Inject MARP's scoped CSS into <head>; clean up on unmount
  useEffect(() => {
    if (!css) return
    const style = document.createElement("style")
    style.setAttribute("data-marp-viewer", slideId)
    style.textContent = css
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [slideId, css])

  if (!raw) {
    return (
      <div className="border border-border rounded-md px-3 py-2 bg-background text-sm text-muted-foreground">
        {title}
      </div>
    )
  }

  const total = slides.length

  const prev = () => setCurrent((c) => Math.max(0, c - 1))
  const next = () => setCurrent((c) => Math.min(total - 1, c + 1))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next() }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev() }
    if (e.key === "Escape") setFullscreen(false)
    if (e.key === "f" || e.key === "F") setFullscreen((v) => !v)
  }

  // Navigation bar (shared between inline and fullscreen)
  const navBar = (
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
  )

  // Fullscreen portal - renders into document.body, escapes all overflow/z-index
  const fullscreenPortal = fullscreen
    ? createPortal(
        <div
          className="marp-portal-overlay"
          onClick={() => setFullscreen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Presentazione: ${title}`}
        >
          <div
            className="marp-portal-canvas"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            ref={portalRef}
          >
            {/* MARP scoped CSS container */}
            <div
              className="marpit marp-portal-marpit"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: slides[current] ?? "" }}
            />
            {navBar}
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      {fullscreenPortal}
      <div className="border border-border rounded-xl overflow-hidden bg-background">
        <div className="px-3 py-2 bg-muted/50 font-semibold text-sm flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs text-muted-foreground font-normal">{total} slide</span>
        </div>
        <div
          ref={inlineRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="marp-viewer marp-inline"
          aria-label={`Slide deck: ${title}`}
        >
          {/* 16:9 slide canvas - SVG inside scales natively via viewBox */}
          <div className="marp-slide-canvas">
            <div
              className="marpit"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: slides[current] ?? "" }}
            />
          </div>
          {navBar}
        </div>
      </div>
    </>
  )
}
