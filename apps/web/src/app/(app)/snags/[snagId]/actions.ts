"use server";

import { revalidatePath } from "next/cache";
import type { SnagStatus } from "@snagflow/shared";
import { createClient } from "@/lib/supabase/server";
import { friendlyTransitionError } from "@/lib/errors";

export type ActionState = {
  error?: string;
  ok?: boolean;
};

/**
 * Runs a workflow transition. The database is the authority: the RPC applies
 * the same rules as `packages/shared/src/workflow.ts` and rejects anything the
 * user is not allowed to do.
 */
export async function transitionSnag(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const snagId = String(formData.get("snagId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as SnagStatus;
  const comment = String(formData.get("comment") ?? "").trim();

  if (!snagId || !toStatus) {
    return { error: "Missing snag or target status." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_snag", {
    p_snag_id: snagId,
    p_to_status: toStatus,
    p_comment: comment.length > 0 ? comment : undefined,
  });

  if (error) {
    return { error: friendlyTransitionError(error.message) };
  }

  revalidatePath(`/snags/${snagId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Adds a comment to the snag thread. RLS restricts this to project members. */
export async function addComment(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const snagId = String(formData.get("snagId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!body) {
    return { error: "Write a comment first." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in to comment." };
  }

  const { error } = await supabase.from("comments").insert({
    snag_id: snagId,
    author_id: user.id,
    body,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/snags/${snagId}`);
  return { ok: true };
}
