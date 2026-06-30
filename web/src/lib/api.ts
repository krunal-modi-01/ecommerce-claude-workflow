export class ApiError extends Error {
  constructor(
    public readonly type: string,
    public readonly title: string,
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  })

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
      const body = await res.json().catch(() => ({}))
      throw new ApiError(
        body.type ?? 'urn:marketplace:error:unknown',
        body.title ?? 'Error',
        body.status ?? res.status,
        body.detail ?? `Request failed with status ${res.status}`,
      )
    }
    throw new ApiError(
      'urn:marketplace:error:unknown',
      'Error',
      res.status,
      `Request failed with status ${res.status}`,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

export function del<T = void>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}
