// Server-side conversation memory: the client holds only the server-issued id — never
// content (a caller-supplied history would be a jailbreak vector; the server refuses it).
// sessionStorage by ruling: one sitting/one tab, matching the server's 2h-from-last-turn
// lifetime. The id changes ONLY on a genuine new conversation (expiry/unknown id) — content
// trimming keeps it — so an id change is exactly when the UI shows a boundary.

export const CONVERSATION_STORAGE = "fmg-help-conversation";

export function getConversationId(): string | null {
  try {
    return sessionStorage.getItem(CONVERSATION_STORAGE);
  } catch {
    return null;
  }
}

// The server's id format. Defensive against regressions/tampering — a poisoned or malformed
// stored value would otherwise 400 every ask for the rest of the session, so a bad value is
// silently dropped rather than stored.
const VALID_ID = /^[A-Za-z0-9_-]{16,64}$/;

export function adoptConversationId(id: string): void {
  if (!VALID_ID.test(id)) return;
  try {
    sessionStorage.setItem(CONVERSATION_STORAGE, id);
  } catch {
    // storage unavailable — the conversation just won't survive a reload
  }
}

export function clearConversationId(): void {
  try {
    sessionStorage.removeItem(CONVERSATION_STORAGE);
  } catch {
    // nothing to clear
  }
}

export function isNewConversation(sentId: string | null, returnedId: string): boolean {
  return sentId !== null && sentId !== returnedId;
}
