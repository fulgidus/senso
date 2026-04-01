import { useMediaQuery } from "./useMediaQuery"

export function useHighContrast(): boolean {
  return useMediaQuery("(prefers-contrast: more)")
}
