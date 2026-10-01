import type { Chat, TranscriptItem } from "../chats";
import { AzgaarServerError, ask } from "./api";

export async function askServer(
  chat: Chat,
  question: string,
  onItem: (item: TranscriptItem) => void,
  signal: AbortSignal
): Promise<void> {
  onItem({ kind: "question", text: question });
  const sentId = chat.serverChatId;
  try {
    const result = await ask(question, sentId, signal);
    if (signal.aborted) return;
    chat.serverChatId = result.conversationId;
    if (sentId && sentId !== result.conversationId) onItem({ kind: "divider" });
    onItem({ kind: "answer", text: result.answer, ratingId: result.requestId });
  } catch (error) {
    if (signal.aborted) return;
    if (error instanceof AzgaarServerError && error.code === "invalid_request") chat.serverChatId = undefined;
    throw error;
  }
}
