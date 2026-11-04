import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@snagflow/shared/db-types';
import { OfflineEngine, transientFailure, type OfflineOperation } from './engine';
import { applySnapshot, localSnags, purgeProject, type Snapshot } from './mirror';
import { readPages, AccessUnavailableError } from '../online';
import { getActiveConnection, getDeploymentKey, isCurrentClient } from '../supabase';
import { guardedFetch, registerScopedClient } from '../connection';
import type { Row, SnagFilters } from '../data';
import type { QueuedPhoto } from '../photos';
import { AnnotationDocumentSchema } from '@snagflow/shared';

type Client = SupabaseClient<Database>;
const engines = new Map<string, Promise<OfflineEngine>>();
let binding: OfflineRuntime | null = null;
let bindingGeneration = 0;
export function offlineFor(client: Client): OfflineRuntime | null {
  return binding?.client === client && binding.active ? binding : null;
}
export function revokeOffline() {
  bindingGeneration++;
  if (binding) binding.active = false;
  binding = null;
}
export async function accountEngine(client: Client, userId: string) {
  const deployment = getDeploymentKey();
  if (!deployment || !isCurrentClient(client)) throw Error('App connection changed.');
  const scope = `${deployment}:${userId}`;
  let engine = engines.get(scope);
  if (!engine) {
    engine = (async () => {
      const { persistence } = await import('./persistence');
      const store = new OfflineEngine(await persistence(), scope);
      await store.load();
      return store;
    })();
    engines.set(scope, engine);
    engine.catch(() => engines.delete(scope));
  }
  return engine;
}
export async function bindOffline(client: Client, userId: string): Promise<OfflineRuntime> {
  revokeOffline();
  const generation = bindingGeneration;
  const engine = await accountEngine(client, userId);
  const { data } = await client.auth.getSession();
  if (
    generation !== bindingGeneration ||
    !isCurrentClient(client) ||
    data.session?.user.id !== userId
  )
    throw Error('Session changed.');
  const runtime = new OfflineRuntime(client, userId, engine);
  binding = runtime;
  return runtime;
}
export class OfflineRuntime {
  active = true;
  capability: 'unknown' | 'supported' | 'unsupported' = 'unknown';
  online = true;
  syncing = false;
  error: string | null = null;
  onChange: () => void = () => {};
  private pending: Promise<void> | null = null;
  constructor(
    readonly client: Client,
    readonly userId: string,
    readonly engine: OfflineEngine,
  ) {}
  private async guard() {
    if (!this.active || !isCurrentClient(this.client))
      throw Error('The account or app connection changed.');
    const { data } = await this.client.auth.getSession();
    if (!this.active || !isCurrentClient(this.client) || data.session?.user.id !== this.userId)
      throw Error('The account or app connection changed.');
  }
  get projects() {
    return Object.values(this.engine.state.mirrors)
      .map((m) => m.project)
      .filter((p) => p.status === 'active');
  }
  context(projectId: string) {
    const m = this.engine.state.mirrors[projectId];
    if (!m) throw new AccessUnavailableError();
    return {
      project: m.project,
      role: m.members.find((x) => x.user_id === this.userId)?.role ?? null,
      locations: m.locations,
      categories: m.categories,
      members: m.members,
    };
  }
  snags(projectId: string | null, filters: SnagFilters = {}, page = 0) {
    const search = (filters.search ?? '').trim().toLowerCase();
    const rows = localSnags(this.engine.state, projectId, this.userId).filter(
      (r) =>
        (!filters.projectIds || filters.projectIds.includes(r.project_id)) &&
        (!filters.status || r.status === filters.status) &&
        (!filters.priority || r.priority === filters.priority) &&
        (!filters.mine || (r.assignee_id === filters.mine && r.status !== 'closed')) &&
        (!filters.review || r.status === 'ready_for_review') &&
        (!filters.location || r.location_id === filters.location) &&
        (!filters.category || r.category_id === filters.category) &&
        (!filters.assignee || r.assignee_id === filters.assignee) &&
        (!filters.createdBy || r.created_by === filters.createdBy) &&
        (!filters.dueBefore || (!!r.due_date && r.due_date <= filters.dueBefore)) &&
        (!search ||
          (/^#?\d+$/.test(search)
            ? r.number === Number(search.replace('#', ''))
            : `${r.title} ${r.description ?? ''}`.toLowerCase().includes(search))),
    );
    rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id));
    return { rows: rows.slice(page * 50, page * 50 + 50), count: rows.length };
  }
  detail(id: string) {
    const snag = localSnags(this.engine.state, null, this.userId).find((s) => s.id === id);
    if (!snag) throw new AccessUnavailableError();
    const mirror = this.engine.state.mirrors[snag.project_id]!;
    const comments = [...mirror.comments.filter((c) => c.snag_id === id)];
    for (const op of this.engine.state.queue.filter((q) => q.snagId === id && q.kind === 'comment'))
      if (!comments.some((c) => c.id === op.id))
        comments.push({
          id: op.id,
          snag_id: id,
          author_id: this.userId,
          body: String(op.payload.body),
          created_at: new Date(op.createdAt).toISOString(),
        });
    const photos = [...mirror.photos.filter((p) => p.snag_id === id)];
    for (const op of this.engine.state.queue.filter((q) => q.snagId === id && q.kind === 'photos'))
      for (const p of op.photos ?? [])
        if (!photos.some((row) => row.id === p.id))
          photos.push({
            id: p.id,
            snag_id: id,
            kind: p.kind,
            storage_path: `${op.projectId}/${id}/${p.id}.jpg`,
            thumb_path: `${op.projectId}/${id}/${p.thumbnailId}.jpg`,
            width: p.width,
            height: p.height,
            taken_at: p.takenAt,
            uploaded_by: this.userId,
            sort_order: photos.length,
            created_at: new Date(op.createdAt).toISOString(),
            updated_at: new Date(op.createdAt).toISOString(),
            annotated_path: p.annotationId ? `${op.projectId}/${id}/${p.annotationId}.jpg` : null,
            annotation_json: p.annotation ?? null,
          });
    return {
      snag,
      context: this.context(snag.project_id),
      photos,
      comments,
      activity: mirror.activity.filter((a) => a.snag_id === id),
    };
  }
  photoUri(id: string, original = false) {
    const cached = this.engine.state.files?.[id];
    if (original) return cached?.originalUri;
    const saved = Object.values(this.engine.state.mirrors)
      .flatMap((m) => m.photos)
      .find((p) => p.id === id);
    const pending = this.engine.state.queue
      .filter((q) => q.state === 'queued')
      .flatMap((q) => (q.photos ?? []).map((p) => ({ q, p })))
      .find(({ p }) => p.id === id && p.annotationId);
    const expectedPath = pending
      ? `${pending.q.projectId}/${pending.q.snagId}/${pending.p.annotationId}.jpg`
      : (saved?.annotated_path ?? null);
    return expectedPath
      ? cached?.annotatedPath === expectedPath
        ? cached.flattenedUri
        : undefined
      : cached?.originalUri;
  }
  async queue(
    kind: OfflineOperation['kind'],
    projectId: string,
    snagId: string,
    payload: Record<string, unknown>,
    id?: string,
    photos?: QueuedPhoto[],
    expectedUpdatedAt?: string,
  ) {
    await this.guard();
    const { randomUUID } = await import('expo-crypto');
    const local = localSnags(this.engine.state, projectId, this.userId).find(
      (s) => s.id === snagId,
    );
    if (!this.engine.state.mirrors[projectId])
      throw Error('Open this project online once before capturing offline.');
    let durable = photos;
    if (photos)
      durable = await (
        await import('./files')
      ).persistPhotos(
        this.engine.scope,
        photos.map((p) =>
          p.annotation && !p.annotationId ? { ...p, annotationId: randomUUID() } : p,
        ),
      );
    await this.guard();
    const createdAt = Date.now();
    await this.engine.enqueue({
      id: id ?? randomUUID(),
      projectId,
      snagId,
      kind,
      payload,
      photos: durable,
      expectedUpdatedAt:
        expectedUpdatedAt ?? local?.updated_at ?? new Date(createdAt).toISOString(),
      createdAt,
      state: 'queued',
      attempts: 0,
      nextAttemptAt: 0,
    });
    if (durable)
      await this.engine.change((s) => {
        s.files ??= {};
        for (const p of durable)
          s.files[p.id] = {
            originalUri: p.originalUri,
            flattenedUri: p.flattenedUri,
            annotatedPath: p.annotationId ? `${projectId}/${snagId}/${p.annotationId}.jpg` : null,
          };
      });
    await this.sync();
  }
  sync(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.performSync().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  async requestClient(): Promise<Client> {
    await this.guard();
    const { data: session } = await this.client.auth.getSession();
    await this.guard();
    const connection = getActiveConnection();
    if (!connection || session.session?.user.id !== this.userId) throw new AccessUnavailableError();
    const token = session.session.access_token;
    const active = () => this.active && isCurrentClient(this.client);
    const client = createClient<Database>(connection.supabaseUrl, connection.supabaseAnonKey, {
      accessToken: async () => {
        if (!active()) throw Error('Account changed.');
        return token;
      },
      global: { fetch: guardedFetch(fetch, active) },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    registerScopedClient(client, this.client, active, this.userId);
    return client;
  }
  private async performSync() {
    this.syncing = true;
    this.onChange();
    try {
      await this.guard();
      // Pin every replay to the originating JWT. SDK auth cannot replace it with another account mid-chain.
      const active = () => this.active && isCurrentClient(this.client);
      const requestClient = await this.requestClient();
      const actor = await requestClient
        .from('profiles')
        .select('id,is_active')
        .eq('id', this.userId)
        .maybeSingle();
      await this.guard();
      if (actor.error) throw actor.error;
      if (!actor.data?.is_active) {
        await this.engine.change((s) => {
          s.profile = null;
          for (const id of Object.keys(s.mirrors)) purgeProject(s, id);
          s.drafts = {};
          s.files = {};
        });
        throw new AccessUnavailableError();
      }
      this.online = true;
      if (this.capability !== 'unsupported')
        await this.engine.flush((op) => this.execute(op, requestClient), active);
      await this.guard();
      const projects = await readPages(async (from, to) => {
        await this.guard();
        const r = await requestClient
          .from('projects')
          .select('*')
          .eq('status', 'active')
          .order('id')
          .range(from, to);
        if (r.error) throw r.error;
        return r.data;
      });
      await this.guard();
      const allowed = new Set(projects.map((p) => p.id));
      await this.engine.change((s) => {
        for (const id of Object.keys(s.mirrors))
          if (!allowed.has(id)) {
            purgeProject(s, id);
          }
      });
      for (const project of projects) {
        await this.guard();
        const previous = this.engine.state.mirrors[project.id];
        const r = await requestClient.rpc('mobile_sync_snapshot', {
          p_project_id: project.id,
          ...(previous ? { p_since: previous.synced_at } : {}),
        });
        if (r.error) {
          if (r.error.code === 'PGRST202') {
            this.capability = 'unsupported';
            this.online = true;
            this.error = 'Offline sync needs a server update. Online changes remain available.';
            return;
          }
          if (
            r.error.code === '42501' ||
            /OFFLINE_UNAVAILABLE|OFFLINE_FORBIDDEN/.test(r.error.message)
          )
            await this.engine.change((s) => {
              purgeProject(s, project.id);
            });
          throw r.error;
        }
        await this.guard();
        const snapshot = r.data as unknown as Snapshot;
        if (!snapshot || snapshot.project?.id !== project.id || !Array.isArray(snapshot.snag_ids))
          throw Error('Offline sync requires the Phase 6 database migration.');
        await this.engine.change((s) => applySnapshot(s, snapshot));
        this.capability = 'supported';
      }
      this.error = null;
    } catch (error) {
      if (!this.active) return;
      this.online = false;
      this.error = transientFailure(error)
        ? null
        : ((error as { message?: string })?.message ??
          'Sync unavailable. Your local work is retained.');
    } finally {
      this.syncing = false;
      if (this.active) this.onChange();
    }
  }
  private async execute(op: OfflineOperation, requestClient: Client) {
    await this.guard();
    // Check current access even for photo writes and repeated receipts.
    const project = await requestClient
      .from('projects')
      .select('id,status')
      .eq('id', op.projectId)
      .maybeSingle();
    await this.guard();
    if (project.error) throw project.error;
    if (!project.data || project.data.status !== 'active') throw new AccessUnavailableError();
    if (op.kind === 'photos') {
      const { uploadPhotos } = await import('../photos');
      const result = await uploadPhotos(
        op.projectId,
        op.snagId,
        op.photos ?? [],
        (photos) => {
          if (this.active)
            void this.engine
              .change((s) => {
                const q = s.queue.find((q) => q.id === op.id);
                if (q) q.photos = photos;
              })
              .catch(() => {});
        },
        0,
        requestClient,
        true,
        this.userId,
      );
      await this.guard();
      if (result.some((p) => p.status !== 'done')) {
        const error = result.find((p) => p.error)?.error ?? 'Upload interrupted. Retry.';
        throw Error(error);
      }
      const saved = await requestClient
        .from('snag_photos')
        .select('*')
        .in(
          'id',
          result.map((p) => p.id),
        );
      if (saved.error) throw saved.error;
      if (saved.data.length !== result.length) throw new AccessUnavailableError();
      await this.guard();
      await this.engine.change((s) => {
        const m = s.mirrors[op.projectId];
        if (m)
          m.photos = [
            ...m.photos.filter((p) => !saved.data.some((r) => r.id === p.id)),
            ...saved.data,
          ];
      });
      return;
    }
    if (op.kind === 'annotation') {
      const photo = op.photos?.[0];
      if (!photo?.annotation || !photo.flattenedUri || !photo.annotationId)
        throw Error('Retained markup is incomplete. Review this draft.');
      const path = `${op.projectId}/${op.snagId}/${photo.annotationId}.jpg`;
      const current = await requestClient
        .from('snag_photos')
        .select('*')
        .eq('id', photo.id)
        .single();
      if (current.error) throw current.error;
      await this.guard();
      const parsed = AnnotationDocumentSchema.safeParse(current.data.annotation_json);
      if (
        current.data.annotated_path === path &&
        parsed.success &&
        JSON.stringify(parsed.data) ===
          JSON.stringify(AnnotationDocumentSchema.parse(photo.annotation))
      ) {
        await this.engine.change((s) => {
          const m = s.mirrors[op.projectId];
          if (m) m.photos = [...m.photos.filter((p) => p.id !== current.data.id), current.data];
        });
        return;
      }
      const { uploadImmutable } = await import('../photos');
      await uploadImmutable(path, photo.flattenedUri, requestClient);
      await this.guard();
      const r = await requestClient.rpc('save_photo_annotation', {
        p_photo_id: photo.id,
        p_expected_updated_at: String(op.payload.expected_updated_at),
        p_annotated_path: path,
        p_annotation_json: photo.annotation,
      });
      if (r.error) throw r.error;
      await this.guard();
      const saved = await requestClient.from('snag_photos').select('*').eq('id', photo.id).single();
      if (saved.error) throw saved.error;
      await this.guard();
      await this.engine.change((s) => {
        const m = s.mirrors[op.projectId];
        if (m) m.photos = [...m.photos.filter((p) => p.id !== saved.data.id), saved.data];
      });
      return;
    }
    const r = await requestClient.rpc('apply_offline_mutation', {
      p_id: op.id,
      p_project_id: op.projectId,
      p_snag_id: op.snagId,
      p_kind: op.kind,
      p_payload: op.payload as Database['public']['Tables']['notifications']['Row']['payload'],
      ...(op.expectedUpdatedAt ? { p_expected_updated_at: op.expectedUpdatedAt } : {}),
    });
    if (r.error) throw r.error;
    await this.guard();
    const result = r.data as unknown as {
      snag: Row<'snags'>;
      skipped_fields?: string[];
      comment?: Row<'comments'>;
    };
    await this.engine.change((s) => {
      const mirror = s.mirrors[op.projectId];
      if (mirror && result.comment)
        mirror.comments = [
          ...mirror.comments.filter((c) => c.id !== result.comment!.id),
          result.comment,
        ];
      if (mirror && result.snag) {
        mirror.snags = [...mirror.snags.filter((s) => s.id !== result.snag.id), result.snag];
        for (const q of s.queue)
          if (
            q.id !== op.id &&
            q.snagId === op.snagId &&
            q.expectedUpdatedAt === op.expectedUpdatedAt
          )
            q.expectedUpdatedAt = result.snag.updated_at;
      }
      if (result.skipped_fields?.length) {
        const q = s.queue.find((q) => q.id === op.id);
        if (q) {
          q.state = 'attention';
          q.error = `Newer server values kept for: ${result.skipped_fields.join(', ')}. Review and discard, or retry as a new edit.`;
        }
      }
    });
    if (result.skipped_fields?.length)
      throw {
        code: 'OFFLINE_FIELD_CONFLICT',
        message: `Newer server values kept for: ${result.skipped_fields.join(', ')}. Your intent is retained for review.`,
      };
  }
}
