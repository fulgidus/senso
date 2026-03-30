/**
 * adminContentApi.ts — Authenticated API client for admin content CRUD.
 *
 * All endpoints hit /admin/content/* and require Bearer token + is_admin=true.
 */

import { apiRequest } from "@/lib/api-client"
import { getBackendBaseUrl } from "@/lib/config"
import { readAccessToken } from "@/features/auth/storage"

const API_BASE = getBackendBaseUrl()

export interface AdminContentItemDTO {
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
  localization_group: string | null
  reading_time_minutes: number | null
  duration_seconds: number | null
  created_at: string | null
  updated_at: string | null
}

export interface PaginatedAdminResponse {
  items: AdminContentItemDTO[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ContentItemCreatePayload {
  id: string
  slug: string
  locale: string
  type: string
  title: string
  summary?: string | null
  body?: string | null
  topics?: string[]
  metadata?: Record<string, unknown>
  is_published?: boolean
  localization_group?: string | null
  reading_time_minutes?: number | null
  duration_seconds?: number | null
}

export interface ContentItemUpdatePayload {
  slug?: string | null
  locale?: string | null
  title?: string | null
  summary?: string | null
  body?: string | null
  topics?: string[] | null
  metadata?: Record<string, unknown> | null
  is_published?: boolean | null
  localization_group?: string | null
  reading_time_minutes?: number | null
  duration_seconds?: number | null
}

function requireToken(): string {
  const token = readAccessToken()
  if (!token) throw new Error("Not authenticated")
  return token
}

// ── List / Query ──────────────────────────────────────────────────────────

export async function listAdminContent(params?: {
  locale?: string
  type?: string
  publishedOnly?: boolean
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: "asc" | "desc"
}): Promise<PaginatedAdminResponse> {
  const sp = new URLSearchParams()
  if (params?.locale) sp.set("locale", params.locale)
  if (params?.type) sp.set("type", params.type)
  if (params?.publishedOnly) sp.set("published_only", "true")
  if (params?.page) sp.set("page", String(params.page))
  if (params?.pageSize) sp.set("page_size", String(params.pageSize))
  if (params?.sortBy) sp.set("sort_by", params.sortBy)
  if (params?.sortDir) sp.set("sort_dir", params.sortDir)
  const qs = sp.toString()
  const path = `/admin/content/items${qs ? `?${qs}` : ""}`
  return apiRequest<PaginatedAdminResponse>(API_BASE, path, {
    token: requireToken(),
  })
}

// ── Single item ───────────────────────────────────────────────────────────

export async function getAdminContentItem(id: string): Promise<AdminContentItemDTO> {
  return apiRequest<AdminContentItemDTO>(
    API_BASE,
    `/admin/content/items/${encodeURIComponent(id)}`,
    { token: requireToken() },
  )
}

// ── Slug collision check ─────────────────────────────────────────────────

export async function checkSlugExists(
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const sp = new URLSearchParams()
  if (excludeId) sp.set("exclude_id", excludeId)
  const qs = sp.toString()
  const res = await apiRequest<{ exists: boolean }>(
    API_BASE,
    `/admin/content/slug-exists/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`,
    { token: requireToken() },
  )
  return res.exists
}

// ── Localization group ───────────────────────────────────────────────────

export async function searchLinkableItems(params: {
  q: string
  contentType: string
  excludeLocale: string
  limit?: number
}): Promise<AdminContentItemDTO[]> {
  const sp = new URLSearchParams({
    q: params.q,
    content_type: params.contentType,
    exclude_locale: params.excludeLocale,
  })
  if (params.limit) sp.set("limit", String(params.limit))
  return apiRequest<AdminContentItemDTO[]>(
    API_BASE,
    `/admin/content/linkable-items?${sp.toString()}`,
    { token: requireToken() },
  )
}

export async function getItemSiblings(itemId: string): Promise<AdminContentItemDTO[]> {
  return apiRequest<AdminContentItemDTO[]>(
    API_BASE,
    `/admin/content/items/${encodeURIComponent(itemId)}/siblings`,
    { token: requireToken() },
  )
}

// ── CUD ───────────────────────────────────────────────────────────────────

export async function createContentItem(
  data: ContentItemCreatePayload,
): Promise<AdminContentItemDTO> {
  return apiRequest<AdminContentItemDTO>(API_BASE, "/admin/content/items", {
    method: "POST",
    token: requireToken(),
    body: data,
  })
}

export async function updateContentItem(
  id: string,
  data: ContentItemUpdatePayload,
): Promise<AdminContentItemDTO> {
  return apiRequest<AdminContentItemDTO>(
    API_BASE,
    `/admin/content/items/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      token: requireToken(),
      body: data,
    },
  )
}

export async function deleteContentItem(
  id: string,
): Promise<{ deleted: boolean }> {
  return apiRequest<{ deleted: boolean }>(
    API_BASE,
    `/admin/content/items/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      token: requireToken(),
    },
  )
}

// ── Bulk operations ───────────────────────────────────────────────────────

export async function bulkPublish(params: {
  itemIds: string[]
  isPublished: boolean
  applyToGroup?: boolean
}): Promise<{ updated: number; groups_affected: number }> {
  return apiRequest(API_BASE, "/admin/content/bulk-publish", {
    method: "POST",
    token: requireToken(),
    body: {
      item_ids: params.itemIds,
      is_published: params.isPublished,
      apply_to_group: params.applyToGroup ?? true,
    },
  })
}

export async function bulkDelete(params: {
  itemIds: string[]
  applyToGroup?: boolean
}): Promise<{ deleted: boolean }> {
  return apiRequest(API_BASE, "/admin/content/bulk-delete", {
    method: "POST",
    token: requireToken(),
    body: {
      item_ids: params.itemIds,
      apply_to_group: params.applyToGroup ?? true,
    },
  })
}
