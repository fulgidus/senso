/**
 * adminMerchantApi.ts - Authenticated API client for admin merchant map and moderation.
 *
 * All endpoints hit /admin/* and require Bearer token + is_admin=true.
 */

import { apiRequest } from "@/lib/api-client"
import { getBackendBaseUrl } from "@/lib/config"
import { readAccessToken } from "@/features/auth/storage"

const API_BASE = getBackendBaseUrl()

export interface MerchantMapAdminDTO {
    id: string
    description_raw: string
    canonical_merchant: string | null
    category: string
    confidence: number
    learned_method: string
    learned_provider_model: string | null
    learned_at: string
    contributing_user_obfuscated: string | null
    is_blacklisted: boolean
    blacklisted_reason: string | null
}

export interface ModerationLogAdminDTO {
    id: string
    user_id: string
    content_type: string
    content_ref_id: string | null
    detected_violations: string[]
    severity: string
    action_taken: string
    created_at: string
}

function requireToken(): string {
    const token = readAccessToken()
    if (!token) throw new Error("Not authenticated")
    return token
}

// ── Merchant Map ──────────────────────────────────────────────────────────────

export async function getMerchantMap(params: {
    search?: string
    method?: string
    blacklisted?: string
    limit?: number
    offset?: number
} = {}): Promise<MerchantMapAdminDTO[]> {
    const q = new URLSearchParams()
    if (params.search) q.set("search", params.search)
    if (params.method) q.set("method", params.method)
    if (params.blacklisted) q.set("blacklisted", params.blacklisted)
    if (params.limit != null) q.set("limit", String(params.limit))
    if (params.offset != null) q.set("offset", String(params.offset))
    const qs = q.toString()
    return apiRequest<MerchantMapAdminDTO[]>(
        API_BASE,
        `/admin/learned-merchants${qs ? `?${qs}` : ""}`,
        { token: requireToken() },
    )
}

export async function blacklistMerchant(merchantId: string, reason: string): Promise<void> {
    await apiRequest<void>(
        API_BASE,
        `/admin/learned-merchants/${encodeURIComponent(merchantId)}/blacklist`,
        {
            method: "POST",
            token: requireToken(),
            body: { reason },
        },
    )
}

export async function unblacklistMerchant(merchantId: string): Promise<void> {
    await apiRequest<void>(
        API_BASE,
        `/admin/learned-merchants/${encodeURIComponent(merchantId)}/unblacklist`,
        {
            method: "POST",
            token: requireToken(),
        },
    )
}

// ── Moderation Queue ──────────────────────────────────────────────────────────

export async function getModerationQueue(statusFilter?: string): Promise<ModerationLogAdminDTO[]> {
    const qs = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : ""
    return apiRequest<ModerationLogAdminDTO[]>(
        API_BASE,
        `/admin/moderation${qs}`,
        { token: requireToken() },
    )
}

export async function confirmModerationAction(logId: string): Promise<void> {
    await apiRequest<void>(
        API_BASE,
        `/admin/moderation/${encodeURIComponent(logId)}/confirm`,
        {
            method: "POST",
            token: requireToken(),
        },
    )
}

export async function revertModerationAction(logId: string): Promise<void> {
    await apiRequest<void>(
        API_BASE,
        `/admin/moderation/${encodeURIComponent(logId)}/revert`,
        {
            method: "POST",
            token: requireToken(),
        },
    )
}

// ── Factory (Pattern B: requireToken() internal, onUnauthorized bound at construction) ──

export type AdminMerchantApiClient = ReturnType<typeof createAdminMerchantApi>

export function createAdminMerchantApi(onUnauthorized?: () => Promise<string | null>) {
    function req<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
        return apiRequest<T>(API_BASE, path, {
            ...opts,
            token: requireToken(),
            onUnauthorized,
        })
    }

    return {
        getMerchantMap: (
            params: {
                search?: string
                method?: string
                blacklisted?: string
                limit?: number
                offset?: number
            } = {},
        ) => {
            const q = new URLSearchParams()
            if (params.search) q.set("search", params.search)
            if (params.method) q.set("method", params.method)
            if (params.blacklisted) q.set("blacklisted", params.blacklisted)
            if (params.limit != null) q.set("limit", String(params.limit))
            if (params.offset != null) q.set("offset", String(params.offset))
            const qs = q.toString()
            return req<MerchantMapAdminDTO[]>(`/admin/learned-merchants${qs ? `?${qs}` : ""}`)
        },

        blacklistMerchant: (merchantId: string, reason: string) =>
            req<void>(
                `/admin/learned-merchants/${encodeURIComponent(merchantId)}/blacklist`,
                { method: "POST", body: { reason } },
            ),

        unblacklistMerchant: (merchantId: string) =>
            req<void>(
                `/admin/learned-merchants/${encodeURIComponent(merchantId)}/unblacklist`,
                { method: "POST" },
            ),

        getModerationQueue: (statusFilter?: string) => {
            const qs = statusFilter
                ? `?status_filter=${encodeURIComponent(statusFilter)}`
                : ""
            return req<ModerationLogAdminDTO[]>(`/admin/moderation${qs}`)
        },

        confirmModerationAction: (logId: string) =>
            req<void>(
                `/admin/moderation/${encodeURIComponent(logId)}/confirm`,
                { method: "POST" },
            ),

        revertModerationAction: (logId: string) =>
            req<void>(
                `/admin/moderation/${encodeURIComponent(logId)}/revert`,
                { method: "POST" },
            ),

        /** Claim or update the admin handle for the authenticated user.
         *  `adminHandle` must include the leading `!` prefix, e.g. `"!myhandle"`.
         *  Replaces the raw dynamic apiRequest import in SettingsScreen and AdminHandleGateModal. */
        claimHandle: (adminHandle: string) =>
            req<{ adminHandle: string }>("/admin/claim-handle", {
                method: "POST",
                body: { adminHandle },
            }),
    }
}
