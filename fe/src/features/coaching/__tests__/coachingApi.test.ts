import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { createCoachingApi, CoachingApiError } from "@/features/coaching/coachingApi";

vi.mock("@/lib/config", () => ({
  getBackendBaseUrl: () => "http://localhost:8000",
}));
vi.mock("@/features/auth/storage", () => ({
  readAccessToken: () => "test-token",
}));

const VALID_SESSION_LIST = [
  {
    id: "s1",
    name: "Session 1",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    message_count: 0,
    last_message_preview: null,
    locale: "it",
    persona_id: "mentore-saggio",
  },
];

describe("createCoachingApi — onUnauthorized wiring", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("listSessions: on 401 calls onUnauthorized and retries", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-access-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(VALID_SESSION_LIST), { status: 200 }));

    const api = createCoachingApi(onUnauthorized);
    const result = await api.listSessions();

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
  });

  it("listSessions: on 401 with null refresh, throws CoachingApiError", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "expired" }), { status: 401 }),
    );

    const api = createCoachingApi(onUnauthorized);
    await expect(api.listSessions()).rejects.toBeInstanceOf(CoachingApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("getPersonas: on 401 calls onUnauthorized", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: "expired" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const api = createCoachingApi(onUnauthorized);
    await api.getPersonas();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
