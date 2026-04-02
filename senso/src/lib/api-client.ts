export class ApiClientError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  token?: string
  body?: unknown
  /** Callback invoked on 401 to refresh the access token. Return the new token
   * string, or `null` if refresh failed (signals to clear session and redirect). */
  onUnauthorized?: () => Promise<string | null>
  /** Internal flag — prevents infinite retry loops. Do NOT set from call sites. */
  _isRetry?: boolean
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { onUnauthorized, _isRetry, ...fetchOptions } = options

  const response = await fetch(`${baseUrl}${path}`, {
    method: fetchOptions.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(fetchOptions.token ? { authorization: `Bearer ${fetchOptions.token}` } : {}),
    },
    body: fetchOptions.body ? JSON.stringify(fetchOptions.body) : undefined,
  })

  const hasBody = response.status !== 204
  const data = hasBody ? ((await response.json()) as unknown) : undefined

  if (!response.ok) {
    // 401-intercept: attempt token refresh and retry once
    if (response.status === 401 && onUnauthorized && !_isRetry) {
      const newToken = await onUnauthorized()
      if (newToken) {
        return apiRequest<T>(baseUrl, path, {
          ...fetchOptions,
          token: newToken,
          onUnauthorized,
          _isRetry: true,
        })
      }
    }
    throw new ApiClientError("Request failed", response.status, data)
  }

  return data as T
}
