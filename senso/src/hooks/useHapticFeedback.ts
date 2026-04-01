export function useHapticFeedback() {
  return {
    tap: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate(10)
      }
    },
    success: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate([10, 50, 10])
      }
    },
    error: () => {
      if ("vibrate" in navigator) {
        navigator.vibrate([50, 30, 50, 30, 50])
      }
    },
  }
}
