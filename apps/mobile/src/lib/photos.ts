import {
  AnnotationDocumentSchema,
  SnagPhotoCreateSchema,
  UUIDSchema,
  type AnnotationDocument,
  type PhotoKind,
} from '@snagflow/shared';
import type { Database } from '@snagflow/shared/db-types';
import { dimensions } from './online';
import { assertConnectionClient } from './connection';
type PhotoClient = typeof import('./supabase').supabase;

export type PhotoStatus = 'queued' | 'preparing' | 'uploading' | 'saving' | 'done' | 'error';
export type QueuedPhoto = {
  id: string;
  thumbnailId: string;
  kind: PhotoKind;
  originalUri: string;
  thumbnailUri: string;
  width: number;
  height: number;
  takenAt: string;
  status: PhotoStatus;
  error?: string;
  annotation?: AnnotationDocument;
  flattenedUri?: string;
  annotationId?: string;
};
type PhotoRow = Database['public']['Tables']['snag_photos']['Row'];
export type PhotoRecord = Pick<
  PhotoRow,
  | 'id'
  | 'snag_id'
  | 'kind'
  | 'storage_path'
  | 'thumb_path'
  | 'uploaded_by'
  | 'width'
  | 'height'
  | 'taken_at'
  | 'sort_order'
  | 'updated_at'
  | 'annotated_path'
  | 'annotation_json'
>;
type NewPhoto = Omit<PhotoRecord, 'updated_at' | 'annotated_path' | 'annotation_json'>;
export type PhotoService = {
  currentUser: () => Promise<string>;
  newId: () => string;
  readPhoto: (id: string) => Promise<PhotoRecord | null>;
  insertPhoto: (photo: NewPhoto) => Promise<PhotoRecord>;
  upload: (path: string, uri: string) => Promise<void>;
  annotate: (
    id: string,
    expectedUpdatedAt: string,
    path: string,
    document: AnnotationDocument,
  ) => Promise<void>;
};
type ImmutableStore = {
  upload: (path: string, bytes: Uint8Array) => Promise<void>;
  read: (path: string) => Promise<{ bytes: Uint8Array; contentType: string }>;
};
const MAX_BYTES = 20 * 1024 * 1024;

/** A duplicate/lost response is successful only when the immutable stored bytes match. */
export async function writeImmutableBytes(
  store: ImmutableStore,
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  if (!bytes.length || bytes.length > MAX_BYTES)
    throw new Error('Choose a photo whose prepared JPEG is no larger than 20 MiB.');
  try {
    await store.upload(path, bytes);
  } catch {
    const stored = await store.read(path);
    if (
      stored.contentType !== 'image/jpeg' ||
      stored.bytes.length !== bytes.length ||
      stored.bytes.some((byte, index) => byte !== bytes[index])
    ) {
      throw new Error(
        'This upload identity contains different image bytes. Keep the original photo and choose this image again.',
      );
    }
  }
}

function samePhoto(row: PhotoRecord, input: NewPhoto) {
  return (
    row.id === input.id &&
    row.snag_id === input.snag_id &&
    row.kind === input.kind &&
    row.storage_path === input.storage_path &&
    row.thumb_path === input.thumb_path &&
    row.uploaded_by === input.uploaded_by &&
    row.width === input.width &&
    row.height === input.height &&
    Date.parse(row.taken_at) === Date.parse(input.taken_at)
  );
}
function sameAnnotation(row: PhotoRecord | null, path: string, document: AnnotationDocument) {
  const parsed = AnnotationDocumentSchema.safeParse(row?.annotation_json);
  return (
    row?.annotated_path === path &&
    parsed.success &&
    JSON.stringify(parsed.data) === JSON.stringify(document)
  );
}

/** Service boundary keeps online reconciliation testable without loading native Expo modules. */
export function createPhotoUploader(service: PhotoService) {
  return async (
    projectId: string,
    snagId: string,
    items: QueuedPhoto[],
    onChange: (items: QueuedPhoto[]) => void,
    sortOffset = 0,
  ): Promise<QueuedPhoto[]> => {
    UUIDSchema.parse(projectId);
    UUIDSchema.parse(snagId);
    if (items.length > 8) throw new Error('A snag can have at most 8 photos.');
    const actor = await service.currentUser();
    const updated = items.map((item) => ({ ...item }));
    for (let index = 0; index < updated.length; index++) {
      if (updated[index]!.status === 'done') continue;
      const status = (next: PhotoStatus, error?: string) => {
        updated[index] = { ...updated[index]!, status: next, error };
        onChange(updated.map((item) => ({ ...item })));
      };
      try {
        status('preparing');
        let item = updated[index]!;
        SnagPhotoCreateSchema.parse({
          id: item.id,
          thumbnailId: item.thumbnailId,
          snagId,
          kind: item.kind,
          width: item.width,
          height: item.height,
          takenAt: item.takenAt,
          sortOrder: Math.min(7, sortOffset + index),
        });
        if (Boolean(item.annotation) !== Boolean(item.flattenedUri))
          throw new Error('This photo markup is incomplete. Open its markup and save it again.');
        if (item.annotation) {
          const annotation = AnnotationDocumentSchema.parse(item.annotation);
          if (annotation.width !== item.width || annotation.height !== item.height)
            throw new Error('Markup dimensions do not match this photo.');
          const annotationId = item.annotationId ?? service.newId();
          UUIDSchema.parse(annotationId);
          if (annotationId === item.id || annotationId === item.thumbnailId)
            throw new Error('Markup must have a separate image identity.');
          item = { ...item, annotation, annotationId };
          updated[index] = item;
          onChange(updated.map((entry) => ({ ...entry })));
        }
        const prefix = `${projectId}/${snagId}`;
        const input: NewPhoto = {
          id: item.id,
          snag_id: snagId,
          kind: item.kind,
          uploaded_by: actor,
          storage_path: `${prefix}/${item.id}.jpg`,
          thumb_path: `${prefix}/${item.thumbnailId}.jpg`,
          width: item.width,
          height: item.height,
          taken_at: item.takenAt,
          sort_order: Math.min(7, sortOffset + index),
        };
        let row = await service.readPhoto(item.id);
        if (row && !samePhoto(row, input))
          throw new Error('This photo identity is already in use. Choose the image again.');
        if (!row) {
          status('uploading');
          await service.upload(input.storage_path, item.originalUri);
          await service.upload(input.thumb_path!, item.thumbnailUri);
          status('saving');
          try {
            row = await service.insertPhoto(input);
          } catch (failure) {
            const committed = await service.readPhoto(item.id);
            if (!committed || !samePhoto(committed, input)) throw failure;
            row = committed;
          }
          if (!samePhoto(row, input))
            throw new Error('The saved photo does not match this draft. Choose the image again.');
        }
        if (item.annotation && item.flattenedUri && item.annotationId) {
          const path = `${prefix}/${item.annotationId}.jpg`;
          if (!sameAnnotation(row, path, item.annotation)) {
            if (row.annotated_path)
              throw new Error(
                'Someone saved newer markup. Open the saved photo and review it before making another edit.',
              );
            status('uploading');
            await service.upload(path, item.flattenedUri);
            status('saving');
            try {
              await service.annotate(item.id, row.updated_at, path, item.annotation);
            } catch (failure) {
              if (!sameAnnotation(await service.readPhoto(item.id), path, item.annotation))
                throw failure;
            }
          }
        }
        status('done');
      } catch (failure) {
        const message =
          failure instanceof Error
            ? failure.message
            : 'The photo could not be saved. Check your connection and retry.';
        status(
          'error',
          message.includes('SNAG_PHOTO_LIMIT')
            ? 'This snag already has 8 photos. Refresh before adding more.'
            : message,
        );
      }
    }
    return updated;
  };
}

export async function pickPhoto(
  source: 'camera' | 'library',
  kind: PhotoKind,
): Promise<QueuedPhoto | null> {
  const [picker, manipulator, crypto] = await Promise.all([
    import('expo-image-picker'),
    import('expo-image-manipulator'),
    import('expo-crypto'),
  ]);
  const permission =
    source === 'camera'
      ? await picker.requestCameraPermissionsAsync()
      : await picker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      `${source === 'camera' ? 'Camera' : 'Photo library'} access is required. Open your phone Settings, choose SnagFlow, and allow ${source === 'camera' ? 'Camera' : 'Photos'} access, then retry.`,
    );
  const result = await (
    source === 'camera' ? picker.launchCameraAsync : picker.launchImageLibraryAsync
  )({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, quality: 1 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('No photo was returned. Try capturing or choosing it again.');
  async function jpeg(uri: string, limit: number) {
    const context = manipulator.ImageManipulator.manipulate(uri, {
      maxWidth: limit,
      maxHeight: limit,
    });
    // Decode orientation first, then derive the target ratio from actual native dimensions.
    const decoded = await context.renderAsync();
    let rendered: typeof decoded | undefined;
    try {
      context.resize(dimensions(decoded.width, decoded.height, limit));
      rendered = await context.renderAsync();
      return await rendered.saveAsync({ format: manipulator.SaveFormat.JPEG, compress: 0.8 });
    } finally {
      rendered?.release();
      decoded.release();
      context.release();
    }
  }
  const original = await jpeg(asset.uri, 1600);
  const thumbnail = await jpeg(original.uri, 400);
  return {
    id: crypto.randomUUID(),
    thumbnailId: crypto.randomUUID(),
    kind,
    originalUri: original.uri,
    thumbnailUri: thumbnail.uri,
    width: original.width,
    height: original.height,
    takenAt: new Date().toISOString(),
    status: 'queued',
  };
}

/** Appends private JPEG bytes; it never overwrites originals or prior annotation revisions. */
export async function uploadImmutable(
  path: string,
  uri: string,
  client: PhotoClient,
): Promise<void> {
  const namespace = await import('./supabase');
  assertConnectionClient(client, namespace.supabase);
  const pieces = path.split('/');
  if (pieces.length !== 3 || !pieces[2]?.endsWith('.jpg'))
    throw new Error('The photo upload path is invalid.');
  for (const part of [pieces[0], pieces[1], pieces[2].slice(0, -4)]) UUIDSchema.parse(part);
  const { Platform } = await import('react-native');
  let bytes: Uint8Array;
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('The prepared photo is unavailable. Choose the image again.');
    bytes = new Uint8Array(await response.arrayBuffer());
  } else {
    const { File } = await import('expo-file-system');
    bytes = new Uint8Array(await new File(uri).arrayBuffer());
  }
  assertConnectionClient(client, namespace.supabase);
  const bucket = client.storage.from('snag-photos');
  await writeImmutableBytes(
    {
      upload: async (objectPath, value) => {
        // Supabase's native client accepts ArrayBuffer; Blob/FormData transforms can corrupt RN uploads.
        const body = new Uint8Array(value).buffer;
        const result = await bucket.upload(objectPath, body, {
          contentType: 'image/jpeg',
          upsert: false,
        });
        if (result.error) throw result.error;
      },
      read: async (objectPath) => {
        const metadata = await bucket.info(objectPath);
        if (
          metadata.error ||
          metadata.data?.contentType !== 'image/jpeg' ||
          metadata.data.size !== bytes.length
        )
          throw new Error('Upload interrupted. Check your connection and retry.');
        const signed = await bucket.createSignedUrl(objectPath, 60);
        if (signed.error || !signed.data)
          throw new Error('The uploaded photo could not be verified. Check your access and retry.');
        const nativeFetch = Platform.OS === 'web' ? fetch : (await import('expo/fetch')).fetch;
        const response = await nativeFetch(signed.data.signedUrl);
        if (!response.ok)
          throw new Error('The uploaded photo could not be verified. Retry saving.');
        return {
          bytes: new Uint8Array(await response.arrayBuffer()),
          contentType: metadata.data.contentType,
        };
      },
    },
    path,
    bytes,
  );
  assertConnectionClient(client, namespace.supabase);
}

export async function uploadPhotos(
  projectId: string,
  snagId: string,
  items: QueuedPhoto[],
  onChange: (items: QueuedPhoto[]) => void,
  sortOffset: number,
  client: PhotoClient,
  replay = false,
  actorId?: string,
): Promise<QueuedPhoto[]> {
  const { offlineFor } = await import('./offline/runtime');
  const offline = !replay ? offlineFor(client) : null;
  if (!replay && actorId && !offline)
    throw Error('The account changed. Your photos stay with the original account.');
  if (!replay && actorId && offline && offline.userId !== actorId)
    throw Error('The account changed. Your photos stay with the original account.');
  if (offline?.capability === 'unsupported')
    return uploadPhotos(
      projectId,
      snagId,
      items,
      onChange,
      sortOffset,
      await offline.requestClient(),
      true,
      actorId ?? offline.userId,
    );
  if (offline && items.length) {
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
    const hash = await digestStringAsync(
      CryptoDigestAlgorithm.SHA256,
      JSON.stringify(['photo-batch', snagId, items.map((p) => p.id)]),
    );
    const operationId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    if (!offline.active || (actorId && offline.userId !== actorId))
      throw Error('The account changed.');
    await offline.queue(
      'photos',
      projectId,
      snagId,
      { photo_ids: items.map((p) => p.id) },
      operationId,
      items,
    );
    const pending = offline.engine.state.queue.some((q) => q.id === operationId);
    const result = items.map((p) => ({
      ...p,
      status: pending ? ('queued' as const) : ('done' as const),
    }));
    onChange(result);
    return result;
  }
  const namespace = await import('./supabase');
  assertConnectionClient(client, namespace.supabase);
  const { randomUUID } = await import('expo-crypto');
  const result = await createPhotoUploader({
    newId: randomUUID,
    upload: (path, uri) => uploadImmutable(path, uri, client),
    currentUser: async () => {
      assertConnectionClient(client, namespace.supabase);
      if (actorId) return actorId;
      const result = await client.auth.getUser();
      if (result.error || !result.data.user)
        throw new Error('Sign in again before saving photos. Your draft is retained.');
      return result.data.user.id;
    },
    readPhoto: async (id) => {
      const result = await client.from('snag_photos').select('*').eq('id', id).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },
    insertPhoto: async (row) => {
      const result = await client.from('snag_photos').insert(row).select('*').single();
      if (result.error || !result.data)
        throw new Error(result.error?.message ?? 'Photo details were not confirmed saved. Retry.');
      return result.data;
    },
    annotate: async (id, expectedUpdatedAt, path, document) => {
      const result = await client.rpc('save_photo_annotation', {
        p_photo_id: id,
        p_expected_updated_at: expectedUpdatedAt,
        p_annotated_path: path,
        p_annotation_json: document,
      });
      if (result.error)
        throw new Error(
          result.error.message.includes('ANNOTATION_CONFLICT')
            ? 'Someone saved newer markup. Review the saved photo before editing it again. Your draft is retained.'
            : 'Markup was not confirmed saved. Check your access and connection, then retry.',
        );
    },
  })(projectId, snagId, items, onChange, sortOffset);
  assertConnectionClient(client, namespace.supabase);
  return result;
}
