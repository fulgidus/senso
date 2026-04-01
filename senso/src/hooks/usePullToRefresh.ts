import { useRef, useState, useCallback, useEffect } from "react"
import { useReducedMotion } from "./useReducedMotion"
import { useHapticFeedback } from "./useHapticFeedback"

const PULL_THRESHOLD = 80 // px to trigger refresh

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  /** Disabled when true (e.g. content is already loading) */
  disabled?: boolean
}

interface UsePullToRefreshReturn {
  containerRef: React.RefCallback<HTMLElement>
  isPulling: boolean
  pullDistance: number
  isRefreshing: boolean
}

/**
 * Attach to a scrollable container to enable pull-to-refresh gesture.
 * - threshold: 80px
 * - Respects prefers-reduced-motion (disables animation, still triggers refresh)
 * - Triggers haptic feedback on activation
 */
export function usePullToRefresh({
  onRefresh,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const reducedMotion = useReducedMotion()
  const haptic = useHapticFeedback()

  const containerElRef = useRef<HTMLElement | null>(null)
  const touchStartYRef = useRef(0)
  const pullingRef = useRef(false)
  const triggeredRef = useRef(false)

  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const isRefreshingRef = useRef(false)

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return
      const el = containerElRef.current
      if (!el) return
      // Only start pull if the container is scrolled to the top
      if (el.scrollTop > 0) return
      touchStartYRef.current = e.touches[0].clientY
      pullingRef.current = false
      triggeredRef.current = false
    },
    [disabled],
  )

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return
      const el = containerElRef.current
      if (!el) return
      if (el.scrollTop > 0) {
        pullingRef.current = false
        setIsPulling(false)
        setPullDistance(0)
        return
      }

      const deltaY = e.touches[0].clientY - touchStartYRef.current
      if (deltaY <= 0) {
        pullingRef.current = false
        setIsPulling(false)
        setPullDistance(0)
        return
      }

      // Prevent native scroll when pulling down past threshold start
      e.preventDefault()

      pullingRef.current = true
      const clamped = Math.min(deltaY, PULL_THRESHOLD * 1.5)
      setIsPulling(true)
      setPullDistance(clamped)

      // Trigger haptic once when threshold is reached
      if (deltaY >= PULL_THRESHOLD && !triggeredRef.current) {
        triggeredRef.current = true
        haptic.tap()
      }
    },
    [disabled, haptic],
  )

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return
    const shouldRefresh = triggeredRef.current

    pullingRef.current = false
    triggeredRef.current = false
    setIsPulling(false)
    setPullDistance(0)

    if (shouldRefresh) {
      isRefreshingRef.current = true
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        isRefreshingRef.current = false
        setIsRefreshing(false)
      }
    }
  }, [onRefresh])

  // Attach/detach listeners when the container element changes
  const containerRef: React.RefCallback<HTMLElement> = useCallback(
    (el) => {
      const prev = containerElRef.current
      if (prev) {
        prev.removeEventListener("touchstart", handleTouchStart)
        prev.removeEventListener("touchmove", handleTouchMove)
        prev.removeEventListener("touchend", handleTouchEnd)
      }

      containerElRef.current = el

      if (el) {
        el.addEventListener("touchstart", handleTouchStart, { passive: true })
        el.addEventListener("touchmove", handleTouchMove, { passive: false })
        el.addEventListener("touchend", handleTouchEnd, { passive: true })
      }
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd],
  )

  // If motion is reduced, clamp pullDistance to 0 for display but still allow refresh
  const displayDistance = reducedMotion ? 0 : pullDistance

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const el = containerElRef.current
      if (el) {
        el.removeEventListener("touchstart", handleTouchStart)
        el.removeEventListener("touchmove", handleTouchMove)
        el.removeEventListener("touchend", handleTouchEnd)
      }
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    containerRef,
    isPulling,
    pullDistance: displayDistance,
    isRefreshing,
  }
}
