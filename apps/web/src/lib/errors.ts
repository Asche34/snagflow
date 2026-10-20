import { TRANSITION_ERRORS } from "@snagflow/shared";

/**
 * The workflow RPC reports failures as `CODE: message`. The codes are the
 * contract (see `TRANSITION_ERRORS` in @snagflow/shared), the copy lives here.
 */
const TRANSITION_MESSAGES: Record<string, string> = {
  [TRANSITION_ERRORS.illegal]: "That status change is not allowed from here.",
  [TRANSITION_ERRORS.forbidden]: "Your role does not allow this action.",
  [TRANSITION_ERRORS.fixPhotoRequired]: "Add a fix photo before requesting review.",
  [TRANSITION_ERRORS.commentRequired]: "A comment is required for this action.",
  [TRANSITION_ERRORS.notFound]: "This snag no longer exists.",
  [TRANSITION_ERRORS.closedByOther]: "Someone else closed this snag while you were working.",
  [TRANSITION_ERRORS.notAssignee]: "Only the assignee can work on this snag.",
};

export function friendlyTransitionError(rawMessage: string): string {
  const code = Object.keys(TRANSITION_MESSAGES).find((key) => rawMessage.includes(key));
  if (code) return TRANSITION_MESSAGES[code];
  return rawMessage.replace(/^SNAG_[A-Z_]+:\s*/, "") || "The action could not be completed.";
}
