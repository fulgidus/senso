import { useMediaQuery } from "./useMediaQuery";

/**
 * Returns true when the primary pointer device is coarse (touch).
 * Uses `(pointer: coarse)` media query — reliable across iOS, Android, and desktop.
 * Desktop mice return false; mobile touchscreens return true.
 *
 * Server-side snapshot defaults to false (desktop fallback, consistent with useMediaQuery).
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
