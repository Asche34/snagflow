'use server';

import { revalidatePath } from 'next/cache';
import { CommentCreateSchema, UUIDSchema, type SnagStatus } from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import { friendlyTransitionError } from '@/lib/errors';

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
  const snagId = String(formData.get('snagId') ?? '');
  const toStatus = String(formData.get('toStatus') ?? '') as SnagStatus;
  const comment = String(formData.get('comment') ?? '').trim();

  if (!snagId || !toStatus) {
    return { error: 'Missing snag or target status.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('transition_snag', {
    p_snag_id: snagId,
    p_to_status: toStatus,
    p_comment: comment.length > 0 ? comment : undefined,
  });

  if (error) {
    return { error: friendlyTransitionError(error.message) };
  }

  revalidatePath(`/snags/${snagId}`);
  revalidatePath('/dashboard');
  return { ok: true };
}

/** Adds a comment to the snag thread. RLS restricts this to project members. */
export async function addComment(input: unknown): Promise<ActionState> {
  const parsed = CommentCreateSchema.extend({ id: UUIDSchema }).safeParse(input);
  if (!parsed.success) return { error: 'Write a comment between 1 and 5,000 characters.' };
  const { id, snagId, body } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You need to be signed in to comment.' };
  }

  const { error } = await supabase.from('comments').insert({
    id,
    snag_id: snagId,
    author_id: user.id,
    body,
  });

  if (error) {
    if (error.code !== '23505')
      return {
        error:
          'The comment could not be posted. Check your connection and current project access, then retry.',
      };
    const existing = await supabase
      .from('comments')
      .select('snag_id,author_id,body')
      .eq('id', id)
      .maybeSingle();
    if (
      !existing.data ||
      existing.data.snag_id !== snagId ||
      existing.data.author_id !== user.id ||
      existing.data.body !== body
    )
      return {
        error:
          'An earlier draft may already be posted. Refresh the thread before posting a changed draft.',
      };
  }

  revalidatePath(`/snags/${snagId}`);
  return { ok: true };
}
