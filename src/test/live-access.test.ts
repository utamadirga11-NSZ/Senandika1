import { afterEach, describe, expect, it, vi } from "vitest";
import { bindLiveConnection, validateLiveUpgrade, type LiveSocket } from "@/lib/live-relay.server";

afterEach(() => vi.useRealTimers());

describe("Voice access protection", () => {
  it("rejects a different website origin", () => {
    expect(validateLiveUpgrade(new Request("https://senandika.lovable.app/api/live", { headers: { origin: "https://other.example", upgrade: "websocket" } }))?.status).toBe(403);
    expect(validateLiveUpgrade(new Request("https://senandika.lovable.app/api/live", { headers: { origin: "https://senandika.lovable.app", upgrade: "websocket" } }))).toBeNull();
  });
  it("does not create a paid session without the signed-in account and thread", async () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    let receive: ((message: unknown) => void) | undefined;
    const connect = vi.fn();
    const tasks: Promise<unknown>[] = [];
    const socket: LiveSocket = { readyState: 1, send: (data) => { sent.push(data); }, close: vi.fn(), onMessage: (handler) => { receive = handler; }, onClose: vi.fn(), onError: vi.fn() };
    bindLiveConnection(socket, { baseURL: "https://ai.gateway.lovable.dev/v1", key: "test-only", liveModel: "openai/gpt-live-1", backendModel: "openai/gpt-6-astra" }, { waitUntil: (task) => { tasks.push(task); } }, connect);
    receive?.(JSON.stringify({ type: "app.start", sdp: "test-offer" }));
    await Promise.all(tasks);
    expect(connect).not.toHaveBeenCalled();
    expect(sent.map((data) => JSON.parse(data).type)).toContain("app.error");
    expect(socket.close).toHaveBeenCalled();
  });
});