import { useState, useEffect } from "react";

/**
 * useKeyboardHeight - returns the current software keyboard height in pixels.
 *
 * Uses window.visualViewport which is the ONLY API that fires reliably on iOS Safari
 * when the software keyboard opens/closes. window.resize does NOT fire on iOS.
 *
 * Formula: keyboard height = total window height - visible viewport height - scroll offset
 *
 * Returns 0 when:
 * - No keyboard is open
 * - visualViewport API is unavailable (older browsers)
 */
export function useKeyboardHeight(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // keyboard height = total window height minus visible viewport minus any scroll offset
      // iOS Safari also fires 'scroll' on visualViewport when keyboard adjusts position
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardHeight(kh);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    // Run once on mount to capture any pre-existing keyboard state
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return keyboardHeight;
}
