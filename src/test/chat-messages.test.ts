import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { visibleChatMessages } from "@/lib/chat-messages";

const message = (id: string, role: UIMessage["role"], text: string): UIMessage => ({ id, role, parts: [{ type: "text", text }] });

describe("Ordered conversation", () => {
  it("shows each user and AI turn once in original order", () => {
    const user = message("user-1", "user", "Hari ini berat");
    const ai = message("ai-1", "assistant", "Aku mendengarkan.");
    expect(visibleChatMessages([user, user, ai, ai, message("user-2", "user", "Terima kasih")]).map(({ id }) => id))
      .toEqual(["user-1", "ai-1", "user-2"]);
  });
  it("hides an empty AI reply while preserving its later text", () => {
    expect(visibleChatMessages([message("u", "user", "Hai"), message("a", "assistant", " "), message("a", "assistant", "Hai juga")]).map(({ id }) => id))
      .toEqual(["u", "a"]);
  });
});