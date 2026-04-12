import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { createIngestionApi } from "@/features/ingestion/api";

vi.mock("@/lib/config", () => ({ getBackendBaseUrl: () => "http://localhost:8000" }));

describe("createIngestionApi — onUnauthorized wiring", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("listUploads: on 401 calls onUnauthorized and retries", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const api = createIngestionApi(onUnauthorized);
    await api.listUploads("old-token");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("listUploads: on 401 with null refresh, throws", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));

    const api = createIngestionApi(onUnauthorized);
    await expect(api.listUploads("bad-token")).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("confirmAll: on 401 calls onUnauthorized", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const api = createIngestionApi(onUnauthorized);
    await api.confirmAll("old-token");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
