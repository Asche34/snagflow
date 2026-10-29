'use server';

import { revalidatePath } from 'next/cache';
import {
  SnagCreateSchema,
  SnagAssignSchema,
  UUIDSchema,
  canAct,
  canEditSnagDetails,
} from '@snagflow/shared';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from './[snagId]/actions';

export type SaveSnagResult = {
  snagId?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

export async function saveSnag(input: unknown): Promise<SaveSnagResult> {
  const parsed = SnagCreateSchema.extend({ snagId: UUIDSchema.optional() }).safeParse(input);
  if (!parsed.success)
    return {
      error: 'Check the highlighted fields.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  const values = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again before saving this snag.' };
  const [{ data: profile }, { data: membership }, { data: project }] = await Promise.all([
    supabase.from('profiles').select('is_admin,is_active').eq('id', user.id).maybeSingle(),
    supabase
      .from('project_members')
      .select('role')
      .eq('project_id', values.projectId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('projects').select('id').eq('id', values.projectId).maybeSingle(),
  ]);
  const actor = { id: user.id, isAdmin: profile?.is_admin ?? false };
  if (!profile?.is_active || !project || !canAct(actor, membership?.role ?? null, 'snag:create')) {
    return { error: 'You no longer have permission to save snags in this project.' };
  }
  for (const [field, table, id] of [
    ['locationId', 'locations', values.locationId],
    ['categoryId', 'categories', values.categoryId],
  ] as const) {
    if (!id) continue;
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq('id', id)
      .eq('project_id', values.projectId)
      .maybeSingle();
    if (error || !data)
      return {
        error: 'Choose a location and category from this project.',
        fieldErrors: { [field]: ['This option is no longer available in the project.'] },
      };
  }
  const details = {
    title: values.title,
    description: values.description ?? null,
    priority: values.priority,
    location_id: values.locationId ?? null,
    category_id: values.categoryId ?? null,
    due_date: values.dueDate ?? null,
  };
  let snagId: string;
  if (values.snagId) {
    const { data: snag } = await supabase
      .from('snags')
      .select('id,project_id,created_by,assignee_id,status')
      .eq('id', values.snagId)
      .is('deleted_at', null)
      .maybeSingle();
    if (
      !snag ||
      snag.project_id !== values.projectId ||
      !canEditSnagDetails({
        actorId: user.id,
        isAdmin: actor.isAdmin,
        projectRole: membership?.role ?? null,
        scope: { createdById: snag.created_by, assigneeId: snag.assignee_id, status: snag.status },
      })
    ) {
      return { error: 'You cannot edit this snag. Your access or its status may have changed.' };
    }
    const { data, error } = await supabase
      .from('snags')
      .update(details)
      .eq('id', snag.id)
      .select('id')
      .maybeSingle();
    if (error || !data)
      return { error: 'The snag could not be updated. Refresh and check your access.' };
    snagId = data.id;
  } else {
    if (values.assigneeId) {
      if (!canAct(actor, membership?.role ?? null, 'snag:assign'))
        return { error: 'Only a manager can assign a snag.' };
      const [{ data: assignee }, { data: active }] = await Promise.all([
        supabase
          .from('project_members')
          .select('role')
          .eq('project_id', values.projectId)
          .eq('user_id', values.assigneeId)
          .maybeSingle(),
        supabase.from('profiles').select('is_active').eq('id', values.assigneeId).maybeSingle(),
      ]);
      if (!active?.is_active || !assignee || assignee.role === 'viewer')
        return {
          error: 'Choose an active member or manager in this project.',
          fieldErrors: { assigneeId: ['This assignee is no longer available.'] },
        };
    }
    const findExisting = () =>
      supabase
        .from('snags')
        .select('id')
        .eq('client_id', values.clientId)
        .eq('project_id', values.projectId)
        .eq('created_by', user.id)
        .is('deleted_at', null)
        .maybeSingle();
    const { data: existing } = await findExisting();
    if (existing) return { snagId: existing.id };
    // The trigger always replaces this placeholder with the locked project counter.
    const { data, error } = await supabase
      .from('snags')
      .insert({
        ...details,
        number: 0,
        project_id: values.projectId,
        client_id: values.clientId,
        created_by: user.id,
        assignee_id: values.assigneeId ?? null,
      })
      .select('id')
      .single();
    if (error || !data) {
      // A response can be lost after commit, or a double submit can race the first insert.
      if (error?.code === '23505') {
        const { data: committed } = await findExisting();
        if (committed) return { snagId: committed.id };
      }
      return { error: 'The snag could not be saved. Check your connection and try again.' };
    }
    snagId = data.id;
  }
  revalidatePath(`/projects/${values.projectId}`);
  revalidatePath(`/snags/${snagId}`);
  revalidatePath('/dashboard');
  return { snagId };
}

export async function assignSnag(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = SnagAssignSchema.safeParse({
    snagId: formData.get('snagId'),
    assigneeId: formData.get('assigneeId') || null,
  });
  if (!parsed.success) return { error: 'Choose a valid assignee.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in again before assigning this snag.' };
  const { data: snag } = await supabase
    .from('snags')
    .select('project_id')
    .eq('id', parsed.data.snagId)
    .maybeSingle();
  if (!snag) return { error: 'This snag is no longer available.' };
  // Generated RPC types cannot express SQL's nullable UUID argument; null unassigns.
  const { error } = await supabase.rpc('assign_snag', {
    p_snag_id: parsed.data.snagId,
    p_assignee_id: parsed.data.assigneeId as string,
  });
  if (error)
    return { error: 'Assignment was not saved. Only managers can assign active project members.' };
  revalidatePath(`/snags/${parsed.data.snagId}`);
  revalidatePath(`/projects/${snag.project_id}`);
  revalidatePath('/dashboard');
  return { ok: true };
}
