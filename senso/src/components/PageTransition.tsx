import { useRef, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Wraps page content with a fade transition on route changes.
 * Out: 80ms, In: 150ms. Respects prefers-reduced-motion.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation()
  const reducedMotion = useReducedMotion()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle")
  const pendingRef = useRef(children)

  useEffect(() => {
    pendingRef.current = children
  })

  useEffect(() => {
    if (reducedMotion) {
      setDisplayChildren(children)
      setPhase("idle")
      return
    }

    // Start fade-out
    setPhase("out")
    const outTimer = setTimeout(() => {
      // Swap content after fade-out completes
      setDisplayChildren(pendingRef.current)
      setPhase("in")
      const inTimer = setTimeout(() => {
        setPhase("idle")
      }, 150)
      return () => clearTimeout(inTimer)
    }, 80)

    return () => clearTimeout(outTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, reducedMotion])

  if (reducedMotion) {
    return <>{children}</>
  }

  return (
    <div
      className={[
        "transition-opacity",
        phase === "out" ? "opacity-0 duration-[80ms]" : "",
        phase === "in" ? "opacity-0 duration-[150ms]" : "",
        phase === "idle" ? "opacity-100 duration-[150ms]" : "",
      ].join(" ")}
    >
      {displayChildren}
    </div>
  )
}
