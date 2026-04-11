import { describe, it, expect, vi, beforeEach } from "vite-plus/test"
import { createIngestionFilesApi } from "@/api/ingestionFilesApi"

vi.mock("@/lib/config", () => ({ getBackendBaseUrl: () => "http://localhost:8000" }))

const UPLOAD_LIST: unknown[] = []

describe("createIngestionFilesApi — onUnauthorized wiring", () => {
    beforeEach(() => vi.restoreAllMocks())

    it("listUploads: on 401 calls onUnauthorized and retries", async () => {
        const onUnauthorized = vi.fn().mockResolvedValue("new-token")
        vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response("{}", { status: 401 }))
            .mockResolvedValueOnce(
                new Response(JSON.stringify(UPLOAD_LIST), { status: 200 }),
            )

        const api = createIngestionFilesApi(onUnauthorized)
        await api.listUploads("old-token")
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })

    it("listUploads: on 401 with null refresh, throws", async () => {
        const onUnauthorized = vi.fn().mockResolvedValue(null)
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }))

        const api = createIngestionFilesApi(onUnauthorized)
        await expect(api.listUploads("bad-token")).rejects.toThrow()
        expect(onUnauthorized).toHaveBeenCalledTimes(1)
    })
})
