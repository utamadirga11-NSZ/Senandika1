import type { UIMessage } from "ai";

export function visibleChatMessages(messages: UIMessage[]): UIMessage[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (!message.id || seen.has(message.id)) return false;
    if (!message.parts.some((part) => part.type === "text" && part.text.trim())) return false;
    seen.add(message.id);
    return true;
  });
}