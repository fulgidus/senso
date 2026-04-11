import { describe, it, expect, vi, beforeEach } from "vite-plus/test"
import { createAdminContentApi } from "@/features/admin/adminContentApi"

vi.mock("@/lib/config", () => ({ getBackendBaseUrl: () => "http://localhost:8000" }))
vi.mock("@/features/auth/storage", () => ({ readAccessToken: () => "test-token" }))

const EMPTY_PAGE = { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }

describe("createAdminContentApi — onUnauthorized wiring", () => {
    beforeEach(() => vi.restoreAllMocks())

    it("listAdminContent: on 401 calls onUnauthorized and retries", async () => {
        const onUnauthorized = vi.fn().mockResolvedValue("new-token")
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response("{}", { status: 401 }))
            .mockResolvedValueOnce(new Response(JSON.stringify(EMPTY_PAGE), { status: 200 }))

        const api = createAdminContentApi(onUnauthorized)
        await api.listAdminContent()
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })

    it("listAdminContent: on 401 with null refresh, throws", async () => {
        const onUnauthorized = vi.fn().mockResolvedValue(null)
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }))

        const api = createAdminContentApi(onUnauthorized)
        await expect(api.listAdminContent()).rejects.toThrow()
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })
})
