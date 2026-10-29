import { describe, expect, it } from 'vitest';
import { SnagPhotoCreateSchema } from '../src/schemas.js';
const photo = {
  id: '70000000-0000-4000-8000-000000000001',
  thumbnailId: '70000000-0000-4000-8000-000000000002',
  snagId: '70000000-0000-4000-8000-000000000003',
  kind: 'issue',
  width: 1600,
  height: 800,
  takenAt: '2026-10-29T15:00:00.000Z',
  sortOrder: 0,
};
describe('photo registration contract', () => {
  it('accepts resized issue and fix metadata', () => {
    expect(SnagPhotoCreateSchema.safeParse(photo).success).toBe(true);
    expect(SnagPhotoCreateSchema.safeParse({ ...photo, kind: 'fix' }).success).toBe(true);
  });
  it.each([
    { width: 0 },
    { height: 1601 },
    { width: 1.5 },
    { kind: 'other' },
    { sortOrder: 8 },
    { takenAt: 'yesterday' },
    { snagId: '../outside' },
    { thumbnailId: photo.id },
  ])('rejects invalid photo metadata %j', (change) => {
    expect(SnagPhotoCreateSchema.safeParse({ ...photo, ...change }).success).toBe(false);
  });
});
