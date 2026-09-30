import type { Answerer } from "../answerer";
import type { Chat, TranscriptItem } from "../chats";
import { AzgaarServerError, ask } from "./api";

export function createAzgaarServerAnswerer(): Answerer {
  return {
    async send(
      chat: Chat,
      question: string,
      onItem: (item: TranscriptItem) => void,
      signal: AbortSignal
    ): Promise<void> {
      onItem({ kind: "question", text: question });
      let retried = false;
      for (;;) {
        try {
          const sentId = chat.serverChatId;
          const result = await ask(question, sentId, signal);
          if (signal.aborted) return;
          chat.serverChatId = result.conversationId;
          if (sentId && sentId !== result.conversationId) onItem({ kind: "divider" });
          onItem({ kind: "answer", text: result.answer, ratingId: result.requestId });
          return;
        } catch (error) {
          if (signal.aborted) return;
          if (error instanceof AzgaarServerError && error.code === "invalid_request") chat.serverChatId = undefined;
          if (error instanceof AzgaarServerError && error.code === "rate_limited" && error.retryAfter && !retried) {
            retried = true;
            onItem({ kind: "notice", text: error.message, retryAt: Date.now() + error.retryAfter * 1000 });
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, error.retryAfter! * 1000);
              signal.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  reject(signal.reason);
                },
                { once: true }
              );
            });
            continue;
          }
          throw error;
        }
      }
    }
  };
}
