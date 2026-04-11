import { describe, it, expect, vi, beforeEach } from "vite-plus/test"
import { createNotificationsApi } from "@/api/notificationsApi"

vi.mock("@/lib/config", () => ({ getBackendBaseUrl: () => "http://localhost:8000" }))
vi.mock("@/features/auth/storage", () => ({ readAccessToken: () => "test-token" }))

const EMPTY_NOTIFICATIONS = { items: [], unread_count: 0 }

describe("createNotificationsApi — onUnauthorized wiring", () => {
    beforeEach(() => vi.restoreAllMocks())

    it("getNotifications: on 401 calls onUnauthorized and retries", async () => {
        const onUnauthorized = vi.fn().mockResolvedValue("new-token")
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response("{}", { status: 401 }))
            .mockResolvedValueOnce(
                new Response(JSON.stringify(EMPTY_NOTIFICATIONS), { status: 200 }),
            )

        const api = createNotificationsApi(onUnauthorized)
        const result = await api.getNotifications()
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
        expect(result.unread_count).toBe(0)
    })

    it("getNotifications: on 401 with null refresh, throws", async () => {
        const onUnauthorized = vi.fn().mockResolvedValue(null)
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }))

        const api = createNotificationsApi(onUnauthorized)
        await expect(api.getNotifications()).rejects.toThrow()
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })
})
