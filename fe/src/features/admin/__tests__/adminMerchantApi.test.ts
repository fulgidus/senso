import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { createAdminMerchantApi } from "@/features/admin/adminMerchantApi";

vi.mock("@/lib/config", () => ({ getBackendBaseUrl: () => "http://localhost:8000" }));
vi.mock("@/features/auth/storage", () => ({ readAccessToken: () => "test-token" }));

describe("createAdminMerchantApi — onUnauthorized wiring", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("getMerchantMap: on 401 calls onUnauthorized and retries", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const api = createAdminMerchantApi(onUnauthorized);
    await api.getMerchantMap();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("getMerchantMap: on 401 with null refresh, throws", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));

    const api = createAdminMerchantApi(onUnauthorized);
    await expect(api.getMerchantMap()).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("claimHandle: on 401 calls onUnauthorized", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ adminHandle: "!admin" }), { status: 200 }),
      );

    const api = createAdminMerchantApi(onUnauthorized);
    await api.claimHandle("!admin");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
