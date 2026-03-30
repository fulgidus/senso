/**
 * contentApi.ts — API client for public (unauthenticated) content endpoints.
 *
 * All endpoints hit the backend's /content/* routes which require no auth.
 */

import { getBackendBaseUrl } from "@/lib/config"

const API_BASE = getBackendBaseUrl()

export interface ContentItemDTO {
  id: string
  slug: string
  locale: string
  type: "article" | "video" | "slide_deck" | "partner_offer"
  title: string
  summary: string | null
  body: string | null
  topics: string[]
  metadata: Record<string, unknown>
  is_published: boolean
  reading_time_minutes: number | null
  duration_seconds: number | null
  localization_group: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface ContentSuggestion {
  id: string
  slug: string
  title: string
  type: string
}

export async function fetchPublicContent(params: {
  locale?: string
  type?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: "asc" | "desc"
  topics?: string[]
  topicsMode?: "any" | "all"
} = {}): Promise<PaginatedResponse<ContentItemDTO>> {
  const sp = new URLSearchParams()
  if (params.locale) sp.set("locale", params.locale)
  if (params.type) sp.set("type", params.type)
  if (params.page) sp.set("page", String(params.page))
  if (params.pageSize) sp.set("page_size", String(params.pageSize))
  if (params.sortBy) sp.set("sort_by", params.sortBy)
  if (params.sortDir) sp.set("sort_dir", params.sortDir)
  if (params.topics && params.topics.length > 0) {
    for (const t of params.topics) sp.append("topics", t)
  }
  if (params.topicsMode) sp.set("topics_mode", params.topicsMode)
  const res = await fetch(`${API_BASE}/content/items?${sp.toString()}`)
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`)
  return res.json()
}

export async function fetchContentItem(id: string): Promise<ContentItemDTO> {
  const res = await fetch(`${API_BASE}/content/items/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`Content item not found: ${res.status}`)
  return res.json()
}

export async function fetchContentItemBySlug(slug: string): Promise<ContentItemDTO> {
  const res = await fetch(`${API_BASE}/content/items/by-slug/${encodeURIComponent(slug)}`)
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

export async function suggestContent(params: {
  q: string
  locale?: string
  limit?: number
}): Promise<ContentSuggestion[]> {
  const sp = new URLSearchParams({ q: params.q })
  if (params.locale) sp.set("locale", params.locale)
  if (params.limit) sp.set("limit", String(params.limit))
  const res = await fetch(`${API_BASE}/content/suggest?${sp.toString()}`)
  if (!res.ok) throw new Error(`Suggest failed: ${res.status}`)
  return res.json()
}

export async function fetchAllTags(locale?: string): Promise<string[]> {
  const sp = new URLSearchParams()
  if (locale) sp.set("locale", locale)
  const res = await fetch(`${API_BASE}/content/tags?${sp.toString()}`)
  if (!res.ok) throw new Error(`Tags fetch failed: ${res.status}`)
  return res.json()
}

export async function fetchLocalizationSiblings(id: string): Promise<ContentItemDTO[]> {
  const res = await fetch(`${API_BASE}/content/items/${encodeURIComponent(id)}/siblings`)
  if (!res.ok) throw new Error(`Siblings fetch failed: ${res.status}`)
  return res.json()
}
