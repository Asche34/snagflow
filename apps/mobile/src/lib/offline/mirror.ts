import type { Row } from '../data';
import type { Mirror, OfflineState } from './engine';
export type Snapshot = Mirror & {
  snag_ids: string[];
  photo_ids: string[];
  comment_ids: string[];
  activity_ids: string[];
};
export function purgeProject(state: OfflineState, projectId: string) {
  const mirror = state.mirrors[projectId];
  const snagIds = new Set([
    ...(mirror?.snags.map((s) => s.id) ?? []),
    ...state.queue.filter((q) => q.projectId === projectId).map((q) => q.snagId),
  ]);
  delete state.mirrors[projectId];
  for (const key of Object.keys(state.drafts))
    if (key.includes(projectId) || [...snagIds].some((id) => key.includes(id)))
      delete state.drafts[key];
  for (const photo of mirror?.photos ?? []) if (state.files) delete state.files[photo.id];
  for (const q of state.queue.filter((q) => q.projectId === projectId)) {
    q.state = 'attention';
    q.error =
      'Project unavailable, archived or access removed. Queued intent retained; discard or ask your administrator.';
  }
}
function reconcile<T extends { id: string }>(previous: T[], delta: T[], ids: string[]) {
  const allowed = new Set(ids);
  const rows = new Map(previous.filter((r) => allowed.has(r.id)).map((r) => [r.id, r]));
  for (const row of delta) if (allowed.has(row.id)) rows.set(row.id, row);
  return [...rows.values()];
}
export function applySnapshot(state: OfflineState, next: Snapshot) {
  const previous = state.mirrors[next.project.id];
  state.mirrors[next.project.id] = {
    ...next,
    snags: reconcile(previous?.snags ?? [], next.snags, next.snag_ids),
    photos: reconcile(previous?.photos ?? [], next.photos, next.photo_ids),
    comments: reconcile(previous?.comments ?? [], next.comments, next.comment_ids),
    activity: reconcile(previous?.activity ?? [], next.activity, next.activity_ids),
  };
  state.lastSynced = next.synced_at;
}
export function localSnags(
  state: OfflineState,
  projectId: string | null,
  userId = '',
): Row<'snags'>[] {
  const rows = new Map(
    Object.values(state.mirrors)
      .filter((m) => !projectId || m.project.id === projectId)
      .flatMap((m) => m.snags)
      .filter((s) => !s.deleted_at)
      .map((s) => [s.id, { ...s }]),
  );
  for (const op of state.queue) {
    if (projectId && op.projectId !== projectId) continue;
    if (!state.mirrors[op.projectId] || op.state === 'attention') continue;
    const previous = rows.get(op.snagId);
    if (op.kind === 'create' && !previous) {
      const time = new Date(op.createdAt).toISOString();
      rows.set(op.snagId, {
        id: op.snagId,
        client_id: op.snagId,
        project_id: op.projectId,
        number: 0,
        title: '',
        description: null,
        priority: 'medium',
        status: 'open',
        assignee_id: null,
        location_id: null,
        category_id: null,
        due_date: null,
        pin_x: null,
        pin_y: null,
        created_by: userId,
        created_at: time,
        updated_at: time,
        closed_at: null,
        closed_by: null,
        deleted_at: null,
        rejection_count: 0,
        search_document: null,
        ...op.payload,
      } as Row<'snags'>);
    } else if (previous && op.kind === 'edit') Object.assign(previous, op.payload);
    else if (previous && op.kind === 'transition')
      previous.status = op.payload.to_status as Row<'snags'>['status'];
    else if (previous && op.kind === 'assign')
      previous.assignee_id = op.payload.assignee_id as string | null;
  }
  return [...rows.values()];
}
