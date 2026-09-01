// First-party help assistant: asks the fmg-bot gateway one question at a time and renders the
// answer as escaped markdown. Replaces the OpenWidget bubble. Client design spec:
// docs/superpowers/specs/2026-09-01-help-box-client-design.md (fork repo).

import type { HelpApiError, Limits } from "@/services/help/api";
import { renderMarkdown } from "@/utils/markdown";

export interface WidgetNotice {
  html: string;
  askDisabled: boolean;
  retryCountdown?: number;
}

const DEFAULT_RETRY_SECONDS = 30;

// Declined states are designed states: the budget/quota text arrives display-ready from the
// server (with live links) and is rendered verbatim — never composed here.
export function noticeFor(error: HelpApiError): WidgetNotice {
  const html = renderMarkdown(error.message);
  switch (error.code) {
    case "cap_reached":
    case "quota":
    case "blocked":
      return { html, askDisabled: true };
    case "rate_limited":
      return { html, askDisabled: true, retryCountdown: error.retryAfter ?? DEFAULT_RETRY_SECONDS };
    default:
      return { html, askDisabled: false };
  }
}

export function limitsLabel(limits: Limits): string {
  if (limits.remaining <= 0) return "No questions left today";
  return `${limits.remaining} question${limits.remaining === 1 ? "" : "s"} left today`;
}

const MAX_QUESTION_LENGTH = 1000;

export function normalizeQuestion(raw: string): string | null {
  const question = raw.trim();
  if (!question.length || question.length > MAX_QUESTION_LENGTH) return null;
  return question;
}
