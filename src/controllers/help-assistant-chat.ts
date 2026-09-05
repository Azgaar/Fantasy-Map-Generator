// The transcript furniture both assistant panels share. Kept apart from either controller so the
// help panel and the map panel can each build rows without importing the other.

// Side is the whole distinction: the assistant speaks from the left, the user from the right
export function buildMessageRow(role: "user" | "bot"): { row: HTMLElement; stack: HTMLElement } {
  const row = document.createElement("div");
  row.className = `helpAssistantMsg ${role}`;

  const stack = document.createElement("div");
  stack.className = "helpAssistantStack";
  row.appendChild(stack);
  return { row, stack };
}

// The wait is a bubble of its own, so the transcript never sits still with nothing to show
export function buildTypingRow(label = "Thinking…"): HTMLElement {
  const { row, stack } = buildMessageRow("bot");
  const bubble = document.createElement("div");
  bubble.className = "helpAssistantBubble helpAssistantTyping";
  bubble.setAttribute("aria-label", label);
  bubble.append(...[0, 1, 2].map(() => document.createElement("i")));
  stack.appendChild(bubble);
  return row;
}
