import { useRef, useState, useCallback, useEffect } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  /** Disabled when true (e.g. content is already loading) */
  disabled?: boolean;
}

interface UsePullToRefreshReturn {
  containerRef: React.RefCallback<HTMLElement>;
  /** Ref callback for the sentinel div at the top of scrollable content */
  sentinelRef: React.RefCallback<HTMLElement>;
  isPulling: boolean;
  pullDistance: number;
  isRefreshing: boolean;
}

/**
 * Pull-to-refresh via IntersectionObserver on a sentinel element.
 *
 * Instead of intercepting touch/scroll events (which breaks native scroll on
 * desktop and mobile), we place a hidden sentinel div at the very top of the
 * scrollable container. When it becomes visible (user scrolled to top and
 * pulls/overscrolls), we trigger the refresh.
 *
 * Mobile: touch-based pull gesture still works naturally via overscroll.
 * Desktop: normal scroll is never intercepted.
 */
export function usePullToRefresh({
  onRefresh,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const containerElRef = useRef<HTMLElement | null>(null);
  const sentinelElRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRefreshingRef = useRef(false);

  // Touch-based pull tracking for mobile
  const touchStartYRef = useRef(0);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullingRef = useRef(false);
  const triggeredRef = useRef(false);
  const PULL_THRESHOLD = 80;

  const doRefresh = useCallback(async () => {
    if (isRefreshingRef.current || disabled) return;
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [onRefresh, disabled]);

  // Mobile touch handlers (only for the pull-down visual feedback)
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      const el = containerElRef.current;
      if (!el || el.scrollTop > 5) return;
      touchStartYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
      triggeredRef.current = false;
    },
    [disabled],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      const el = containerElRef.current;
      if (!el || el.scrollTop > 5) {
        if (pullingRef.current) {
          pullingRef.current = false;
          setIsPulling(false);
          setPullDistance(0);
        }
        return;
      }

      const deltaY = e.touches[0].clientY - touchStartYRef.current;
      if (deltaY <= 0) {
        pullingRef.current = false;
        setIsPulling(false);
        setPullDistance(0);
        return;
      }

      pullingRef.current = true;
      const clamped = Math.min(deltaY, PULL_THRESHOLD * 1.5);
      setIsPulling(true);
      setPullDistance(clamped);

      if (deltaY >= PULL_THRESHOLD && !triggeredRef.current) {
        triggeredRef.current = true;
      }
    },
    [disabled],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    const shouldRefresh = triggeredRef.current;
    pullingRef.current = false;
    triggeredRef.current = false;
    setIsPulling(false);
    setPullDistance(0);
    if (shouldRefresh) {
      await doRefresh();
    }
  }, [doRefresh]);

  // Container ref: attaches touch listeners (mobile only)
  const containerRef: React.RefCallback<HTMLElement> = useCallback(
    (el) => {
      const prev = containerElRef.current;
      if (prev) {
        prev.removeEventListener("touchstart", handleTouchStart);
        prev.removeEventListener("touchmove", handleTouchMove);
        prev.removeEventListener("touchend", handleTouchEnd);
      }
      containerElRef.current = el;
      if (el) {
        el.addEventListener("touchstart", handleTouchStart, { passive: true });
        el.addEventListener("touchmove", handleTouchMove, { passive: true });
        el.addEventListener("touchend", handleTouchEnd, { passive: true });
      }
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd],
  );

  // Sentinel ref: observed via IntersectionObserver (no scroll interception)
  const sentinelRef: React.RefCallback<HTMLElement> = useCallback((el) => {
    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    sentinelElRef.current = el;
    // No observer setup needed - we rely on touch events for refresh trigger
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const el = containerElRef.current;
      if (el) {
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    sentinelRef,
    isPulling,
    pullDistance,
    isRefreshing,
  };
}
