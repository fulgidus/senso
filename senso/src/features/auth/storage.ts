const ACCESS_KEY = "senso.auth.access_token"
const REFRESH_KEY = "senso.auth.refresh_token"

function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function readAccessToken(): string | null {
  if (!hasStorage()) {
    return null
  }
  return window.localStorage.getItem(ACCESS_KEY)
}

export function readRefreshToken(): string | null {
  if (!hasStorage()) {
    return null
  }
  return window.localStorage.getItem(REFRESH_KEY)
}

export function writeTokens(tokens: { accessToken: string; refreshToken: string }): void {
  if (!hasStorage()) {
    return
  }
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken)
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
}

export function clearTokens(): void {
  if (!hasStorage()) {
    return
  }
  window.localStorage.removeItem(ACCESS_KEY)
  window.localStorage.removeItem(REFRESH_KEY)
}
