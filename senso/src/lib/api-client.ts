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
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const hasBody = response.status !== 204
  const data = hasBody ? ((await response.json()) as unknown) : undefined

  if (!response.ok) {
    throw new ApiClientError("Request failed", response.status, data)
  }

  return data as T
}
