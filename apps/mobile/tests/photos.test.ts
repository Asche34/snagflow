import { describe, expect, it } from 'vitest';
import type { AnnotationDocument } from '@snagflow/shared';
import {
  createPhotoUploader,
  writeImmutableBytes,
  type PhotoRecord,
  type PhotoService,
  type QueuedPhoto,
} from '../src/lib/photos';

const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  snagId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const photoId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  thumbId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  annotationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const item: QueuedPhoto = {
  id: photoId,
  thumbnailId: thumbId,
  kind: 'issue',
  originalUri: 'original.jpg',
  thumbnailUri: 'thumb.jpg',
  width: 1200,
  height: 1600,
  takenAt: '2026-11-02T10:00:00.000Z',
  status: 'queued',
};
const document: AnnotationDocument = { version: 1, width: 1200, height: 1600, objects: [] };
function fixture() {
  let row: PhotoRecord | null = null;
  const uploaded = new Map<string, string>();
  const service: PhotoService = {
    currentUser: async () => 'actor',
    newId: () => annotationId,
    readPhoto: async () => row,
    insertPhoto: async (insert) => {
      row = {
        ...insert,
        updated_at: '2026-11-02T10:01:00.000Z',
        annotated_path: null,
        annotation_json: null,
      };
      return row;
    },
    upload: async (path, uri) => {
      if (uploaded.has(path) && uploaded.get(path) !== uri) throw Error('Immutable bytes differ');
      uploaded.set(path, uri);
    },
    annotate: async (_id, _expected, path, annotation) => {
      if (!row) throw Error('Missing photo');
      row = { ...row, annotated_path: path, annotation_json: annotation };
    },
  };
  return {
    service,
    uploaded,
    row: () => row,
    setRow: (value: PhotoRecord) => {
      row = value;
    },
  };
}

describe('immutable native photo preparation and registration', () => {
  it('reconciles exact byte retries and refuses same-size different bytes', async () => {
    const stored = new Map<string, Uint8Array>();
    const store = {
      upload: async (path: string, bytes: Uint8Array) => {
        if (stored.has(path)) throw Error('Duplicate');
        stored.set(path, bytes.slice());
        throw Error('Lost upload response');
      },
      read: async (path: string) => ({ bytes: stored.get(path)!, contentType: 'image/jpeg' }),
    };
    await writeImmutableBytes(store, 'photo.jpg', new Uint8Array([1, 2, 3]));
    await expect(
      writeImmutableBytes(store, 'photo.jpg', new Uint8Array([3, 2, 1])),
    ).rejects.toThrow();
    expect([...stored.get('photo.jpg')!]).toEqual([1, 2, 3]);
  });

  it('reports stage progress and registers stable original and thumbnail paths', async () => {
    const setup = fixture(),
      stages: string[] = [];
    const result = await createPhotoUploader(setup.service)(projectId, snagId, [item], (items) =>
      stages.push(items[0]!.status),
    );
    expect(stages).toEqual(['preparing', 'uploading', 'saving', 'done']);
    expect(result[0]).toMatchObject({
      id: photoId,
      thumbnailId: thumbId,
      originalUri: 'original.jpg',
      status: 'done',
    });
    expect(setup.row()).toMatchObject({
      id: photoId,
      snag_id: snagId,
      uploaded_by: 'actor',
      storage_path: `${projectId}/${snagId}/${photoId}.jpg`,
      thumb_path: `${projectId}/${snagId}/${thumbId}.jpg`,
      width: 1200,
      height: 1600,
    });
  });

  it('reconciles a committed metadata insert whose response was lost', async () => {
    const setup = fixture(),
      insert = setup.service.insertPhoto;
    setup.service.insertPhoto = async (row) => {
      await insert(row);
      throw Error('Response lost');
    };
    const result = await createPhotoUploader(setup.service)(projectId, snagId, [item], () => {});
    expect(result[0]!.status).toBe('done');
    expect(setup.row()?.id).toBe(photoId);
  });

  it('rejects an identity collision before uploading or changing the existing record', async () => {
    const setup = fixture();
    await createPhotoUploader(setup.service)(projectId, snagId, [item], () => {});
    setup.setRow({ ...setup.row()!, kind: 'fix', uploaded_by: 'someone-else' });
    setup.uploaded.clear();
    const result = await createPhotoUploader(setup.service)(projectId, snagId, [item], () => {});
    expect(result[0]!.status).toBe('error');
    expect(setup.uploaded.size).toBe(0);
    expect(setup.row()).toMatchObject({ kind: 'fix', uploaded_by: 'someone-else' });
  });

  it('retains annotation identity and draft across a failed save and exact retry', async () => {
    const setup = fixture(),
      annotate = setup.service.annotate;
    setup.service.annotate = async () => {
      throw Error('Network interrupted');
    };
    const upload = createPhotoUploader(setup.service);
    const failed = await upload(
      projectId,
      snagId,
      [{ ...item, annotation: document, flattenedUri: 'flattened.jpg' }],
      () => {},
    );
    expect(failed[0]).toMatchObject({
      status: 'error',
      annotationId,
      annotation: document,
      flattenedUri: 'flattened.jpg',
    });
    setup.service.annotate = annotate;
    const retried = await upload(projectId, snagId, failed, () => {});
    expect(retried[0]).toMatchObject({ status: 'done', annotationId });
    expect(setup.row()?.annotated_path).toBe(`${projectId}/${snagId}/${annotationId}.jpg`);
    expect(setup.uploaded.size).toBe(3);
  });

  it('reconciles a committed annotation response and refuses to overwrite newer markup', async () => {
    const setup = fixture(),
      annotate = setup.service.annotate;
    setup.service.annotate = async (...args) => {
      await annotate(...args);
      throw Error('Response lost');
    };
    const upload = createPhotoUploader(setup.service);
    const result = await upload(
      projectId,
      snagId,
      [{ ...item, annotation: document, flattenedUri: 'flattened.jpg' }],
      () => {},
    );
    expect(result[0]!.status).toBe('done');
    setup.setRow({ ...setup.row()!, annotated_path: 'someone-elses-markup.jpg' });
    const conflict = await upload(
      projectId,
      snagId,
      [{ ...result[0]!, status: 'error' }],
      () => {},
    );
    expect(conflict[0]!.status).toBe('error');
    expect(setup.row()?.annotated_path).toBe('someone-elses-markup.jpg');
  });

  it('keeps failed originals available for retry and skips confirmed completed items', async () => {
    const setup = fixture();
    setup.service.upload = async () => {
      throw Error('Connection interrupted');
    };
    const result = await createPhotoUploader(setup.service)(
      projectId,
      snagId,
      [item, { ...item, status: 'done' }],
      () => {},
    );
    expect(result[0]).toMatchObject({
      status: 'error',
      originalUri: 'original.jpg',
      thumbnailUri: 'thumb.jpg',
    });
    expect(result[1]!.status).toBe('done');
    expect(setup.row()).toBeNull();
  });
});
