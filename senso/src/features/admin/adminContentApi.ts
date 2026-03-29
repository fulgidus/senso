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

export interface ContentItemCreatePayload {
  id: string
  locale: string
  type: string
  title: string
  summary?: string | null
  topics?: string[]
  metadata?: Record<string, unknown>
  is_published?: boolean
}

export interface ContentItemUpdatePayload {
  title?: string | null
  summary?: string | null
  topics?: string[] | null
  metadata?: Record<string, unknown> | null
  is_published?: boolean | null
}

function requireToken(): string {
  const token = readAccessToken()
  if (!token) throw new Error("Not authenticated")
  return token
}

export async function listAdminContent(params?: {
  locale?: string
  type?: string
  publishedOnly?: boolean
}): Promise<AdminContentItemDTO[]> {
  const sp = new URLSearchParams()
  if (params?.locale) sp.set("locale", params.locale)
  if (params?.type) sp.set("type", params.type)
  if (params?.publishedOnly) sp.set("published_only", "true")
  const qs = sp.toString()
  const path = `/admin/content/items${qs ? `?${qs}` : ""}`
  return apiRequest<AdminContentItemDTO[]>(API_BASE, path, {
    token: requireToken(),
  })
}

export async function getAdminContentItem(id: string): Promise<AdminContentItemDTO> {
  return apiRequest<AdminContentItemDTO>(
    API_BASE,
    `/admin/content/items/${encodeURIComponent(id)}`,
    { token: requireToken() },
  )
}

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
