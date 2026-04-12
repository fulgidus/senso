import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { createMessagesApi } from "@/features/messages/messagesApi";

vi.mock("@/lib/config", () => ({ getBackendBaseUrl: () => "http://localhost:8000" }));
vi.mock("@/features/auth/storage", () => ({ readAccessToken: () => "test-token" }));

describe("createMessagesApi — onUnauthorized wiring", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("pollMessages: on 401 calls onUnauthorized and retries", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [] }), { status: 200 }));

    const api = createMessagesApi(onUnauthorized);
    const result = await api.pollMessages();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it("pollMessages: on 401 with null refresh, throws", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));

    const api = createMessagesApi(onUnauthorized);
    await expect(api.pollMessages()).rejects.toThrow();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
