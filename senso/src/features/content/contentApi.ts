/**
 * contentApi.ts — API client for public (unauthenticated) content endpoints.
 *
 * All endpoints hit the backend's /content/* routes which require no auth.
 */

import { getBackendBaseUrl } from "@/lib/config"

const API_BASE = getBackendBaseUrl()

export interface ContentItemDTO {
  id: string
  locale: string
  type: "article" | "video" | "slide_deck" | "partner_offer"
  title: string
  summary: string | null
  topics: string[]
  metadata: Record<string, unknown>
  is_published: boolean
  created_at: string | null
  updated_at: string | null
}

export async function fetchPublicContent(params: {
  locale?: string
  type?: string
  page?: number
  pageSize?: number
} = {}): Promise<ContentItemDTO[]> {
  const sp = new URLSearchParams()
  if (params.locale) sp.set("locale", params.locale)
  if (params.type) sp.set("type", params.type)
  if (params.page) sp.set("page", String(params.page))
  if (params.pageSize) sp.set("page_size", String(params.pageSize))
  const res = await fetch(`${API_BASE}/content/items?${sp.toString()}`)
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`)
  return res.json()
}

export async function fetchContentItem(id: string): Promise<ContentItemDTO> {
  const res = await fetch(`${API_BASE}/content/items/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`Content item not found: ${res.status}`)
  return res.json()
}

export async function searchContent(params: {
  q: string
  locale?: string
  topK?: number
  type?: string
}): Promise<Array<ContentItemDTO & { score: number }>> {
  const sp = new URLSearchParams({ q: params.q })
  if (params.locale) sp.set("locale", params.locale)
  if (params.topK) sp.set("top_k", String(params.topK))
  if (params.type) sp.set("type", params.type)
  const res = await fetch(`${API_BASE}/content/search?${sp.toString()}`)
  if (!res.ok) throw new Error(`Search failed: ${res.status}`)
  return res.json()
}
