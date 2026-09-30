import type { Chat, TranscriptItem } from "./chats";
import type { ToolDefinition, ToolInput, ToolResultBlock } from "./providers";

export interface ToolOutcome {
  content: ToolResultBlock["content"];
  item?: TranscriptItem;
  isError?: boolean;
}

export interface Tool {
  definition: ToolDefinition;
  status: string; // what the Assistant is doing while the tool runs
  handle(input: ToolInput): Promise<ToolOutcome>;
}

export interface Answerer {
  send(
    chat: Chat,
    question: string,
    onItem: (item: TranscriptItem) => void,
    signal: AbortSignal,
    onStatus?: (status: string) => void
  ): Promise<void>;
}
