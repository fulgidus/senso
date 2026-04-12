import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { createProfileApi } from "@/lib/profile-api";

vi.mock("@/lib/config", () => ({
  getBackendBaseUrl: () => "http://localhost:8000",
}));

const VALID_PROFILE = {
  id: "p1",
  userId: "u1",
  incomeSummary: null,
  monthlyExpenses: null,
  monthlyMargin: null,
  categoryTotals: {},
  insightCards: [],
  questionnaireAnswers: null,
  dataSources: [],
  confirmed: false,
  profileGeneratedAt: null,
  updatedAt: new Date().toISOString(),
};

describe("createProfileApi — onUnauthorized wiring", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("getProfile: on 401 calls onUnauthorized and retries with new token", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-access-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(VALID_PROFILE), { status: 200 }));

    const api = createProfileApi(onUnauthorized);
    const result = await api.getProfile("old-token");

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: "p1" });
  });

  it("getProfile: on 401 with onUnauthorized returning null, throws", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "expired" }), { status: 401 }),
    );

    const api = createProfileApi(onUnauthorized);
    await expect(api.getProfile("bad-token")).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("getProfileStatus: passes onUnauthorized to apiRequest", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "complete" }), { status: 200 }));

    const api = createProfileApi(onUnauthorized);
    await api.getProfileStatus("old-token");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
