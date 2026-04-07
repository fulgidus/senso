/**
 * MarpSlideViewer - renders a MARP markdown slide deck inline in chat.
 *
 * - Looks up the raw .md source by slide_id from SLIDE_INDEX
 * - Strips the MARP front-matter block (lines between the first two `---` separators)
 * - Splits remaining content on `---` separators (with surrounding whitespace) to get individual slide bodies
 * - Renders each slide's markdown to HTML via `marked`
 * - Shows a swipeable prev/next navigation and a fullscreen toggle
 * - Applies `senso-light` or `senso-dark` CSS class based on the app's dark mode
 */

import { useState, useEffect, useRef } from "react"
import { marked } from "marked"
import { SLIDE_INDEX } from "@/content/slideIndex"

// Enable GFM line breaks so single newlines within a paragraph render as <br>
marked.setOptions({ breaks: true })

interface MarpSlideViewerProps {
    slideId: string
    title: string
}

/**
 * Strip the MARP front-matter block (everything between the opening `---` and
 * the closing `---`), then split on `---` slide separators to get individual slide bodies.
 * Handles both `\n---\n` and `\n\n---\n\n` separator forms used in MARP decks.
 */
function parseSlides(raw: string): string[] {
    // Remove the front-matter block: lines 0..N where line 0 and lineN are "---"
    const lines = raw.split("\n")
    let fmEnd = -1
    if (lines[0]?.trim() === "---") {
        for (let i = 1; i < lines.length; i++) {
            if (lines[i]?.trim() === "---") {
                fmEnd = i
                break
            }
        }
    }
    const body = fmEnd >= 0 ? lines.slice(fmEnd + 1).join("\n") : raw

    // Split on `---` slide separators. MARP uses `\n---\n` or `\n\n---\n\n` patterns.
    // The regex matches an optional newline before and after `---` to handle both forms.
    return body
        .split(/\n[ \t]*---[ \t]*\n/)
        .map((s) => s.trim())
        .filter(Boolean)
}

function renderSlide(md: string): string {
    // marked.parse can return string | Promise<string>; we call it synchronously
    const result = marked.parse(md, { async: false })
    return result as string
}

export function MarpSlideViewer({ slideId, title }: MarpSlideViewerProps) {
    const raw = SLIDE_INDEX[slideId]
    const [current, setCurrent] = useState(0)
    const [fullscreen, setFullscreen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Reset to first slide when the deck changes (prevents showing slide N of a new deck)
    useEffect(() => {
        setCurrent(0)
    }, [slideId])

    // Detect dark mode from document root class (Tailwind dark mode)
    const [isDark, setIsDark] = useState(
        () => document.documentElement.classList.contains("dark")
    )
    useEffect(() => {
        const obs = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains("dark"))
        })
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
        return () => obs.disconnect()
    }, [])

    if (!raw) {
        return (
            <div className="border border-border rounded-md px-3 py-2 bg-background text-sm text-muted-foreground">
                {title}
            </div>
        )
    }

    const slides = parseSlides(raw)
    const total = slides.length
    const themeClass = isDark ? "senso-dark" : "senso-light"

    const prev = () => setCurrent((c) => Math.max(0, c - 1))
    const next = () => setCurrent((c) => Math.min(total - 1, c + 1))

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next()
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev()
        if (e.key === "Escape") setFullscreen(false)
        if (e.key === "f" || e.key === "F") setFullscreen((v) => !v)
    }

    const viewer = (
        <div
            ref={containerRef}
            className={`marp-viewer ${themeClass} ${fullscreen ? "marp-fullscreen" : "marp-inline"}`}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            aria-label={`Slide deck: ${title}`}
        >
            {/* Slide content */}
            <div
                className="marp-slide"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: renderSlide(slides[current] ?? "") }}
            />

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

    if (fullscreen) {
        return (
            <div className="marp-fullscreen-overlay" onClick={() => setFullscreen(false)}>
                <div onClick={(e) => e.stopPropagation()}>{viewer}</div>
            </div>
        )
    }

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
