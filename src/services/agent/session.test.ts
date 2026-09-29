import { describe, expect, it } from "vitest";
import type { Message } from "./providers";
import { trimHistory } from "./session";

const toolResult = (content: string): Message => ({
  role: "user",
  content: [{ type: "tool_result", tool_use_id: content, content }]
});

const contents = (messages: Message[]): string[] =>
  messages.flatMap(message =>
    message.content.filter(block => block.type === "tool_result").map(block => block.content)
  );

describe("trimHistory", () => {
  it("keeps every result while the conversation is short", () => {
    const messages = [toolResult("a"), toolResult("b")];
    trimHistory(messages);
    expect(contents(messages)).toEqual(["a", "b"]);
  });

  it("replaces all but the most recent results once the conversation grows", () => {
    const messages = ["a", "b", "c", "d", "e", "f", "g", "h"].map(toolResult);
    trimHistory(messages);
    expect(contents(messages)).toEqual([
      "[earlier script output trimmed to save tokens]",
      "[earlier script output trimmed to save tokens]",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h"
    ]);
  });

  it("leaves messages that carry no results alone", () => {
    const messages: Message[] = [{ role: "assistant", content: [{ type: "text", text: "hello" }] }];
    trimHistory(messages);
    expect(messages[0].content).toEqual([{ type: "text", text: "hello" }]);
  });
});
