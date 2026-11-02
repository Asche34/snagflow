import { describe, expect, it } from 'vitest';
import { AnnotationDocumentSchema, canAnnotatePhoto, moveAnnotation } from '../src/annotations.js';

const shape = { id: '70000000-0000-4000-8000-000000000001', type: 'rectangle' as const, x: 10, y: 20, width: 100, height: 80, colour: '#dc2626', strokeWidth: 4 };
const document = { version: 1, width: 1600, height: 800, objects: [shape] };
describe('editable photo annotations', () => {
  it('accepts empty documents and all six editable tools', () => {
    expect(AnnotationDocumentSchema.safeParse({ ...document, objects: [] }).success).toBe(true);
    for (const object of [shape, { ...shape, type: 'circle' }, { ...shape, type: 'pen', points: [0, 0, 50, 40, 100, 80] }, { ...shape, type: 'arrow', points: [0, 0, 100, 80] }, { ...shape, type: 'text', text: 'Replace tile', fontSize: 24 }, { ...shape, type: 'measurement', text: '120 mm', fontSize: 24 }]) {
      expect(AnnotationDocumentSchema.safeParse({ ...document, objects: [object] }).success).toBe(true);
    }
  });
  it.each([{ version: 2 }, { extra: 'unknown' }, { width: Infinity }, { height: 0 }, { objects: [{ ...shape, type: 'script' }] }, { objects: [{ ...shape, x: -1 }] }, { objects: [{ ...shape, x: 1599 }] }, { objects: [{ ...shape, colour: 'url(evil)' }] }, { objects: [{ ...shape, type: 'pen', points: [0, 0, 3] }] }, { objects: [{ ...shape, type: 'text', text: 'x'.repeat(201), fontSize: 24 }] }, { objects: Array.from({ length: 201 }, () => shape) }])('rejects malformed, unsupported or unbounded documents %j', (change) => {
    expect(AnnotationDocumentSchema.safeParse({ ...document, ...change }).success).toBe(false);
  });
  it('rejects duplicate object identities and points outside their box', () => {
    expect(AnnotationDocumentSchema.safeParse({ ...document, objects: [shape, shape] }).success).toBe(false);
    expect(AnnotationDocumentSchema.safeParse({ ...document, objects: [{ ...shape, type: 'pen', points: [0, 0, 101, 80] }] }).success).toBe(false);
  });
  it('rejects individually oversized strokes and a collectively oversized vector payload', () => {
    const pen = { ...shape, type: 'pen', points: Array.from({ length: 4002 }, () => 0) };
    expect(AnnotationDocumentSchema.safeParse({ ...document, objects: [pen] }).success).toBe(false);
    const objects = Array.from({ length: 80 }, (_, index) => ({ ...shape, id: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`, type: 'pen', points: Array.from({ length: 2000 }, () => 0) }));
    expect(AnnotationDocumentSchema.safeParse({ ...document, objects }).success).toBe(false);
  });
  it('keeps move-button and drag coordinates within original-image dimensions', () => {
    expect(moveAnnotation(shape, -200, 1000, 1600, 800)).toMatchObject({ x: 0, y: 720, width: 100, height: 80 });
    expect(moveAnnotation(shape, 10, -10, 1600, 800)).toMatchObject({ x: 20, y: 10 });
  });
  it('allows reviewers or a still-authorized member uploader only', () => {
    const actor = { id: 'uploader', isAdmin: false, projectRole: 'member' as const, uploadedBy: 'uploader' };
    expect(canAnnotatePhoto(actor)).toBe(true);
    expect(canAnnotatePhoto({ ...actor, uploadedBy: 'other' })).toBe(false);
    expect(canAnnotatePhoto({ ...actor, projectRole: 'viewer' })).toBe(false);
    expect(canAnnotatePhoto({ ...actor, projectRole: null })).toBe(false);
    expect(canAnnotatePhoto({ ...actor, projectRole: 'manager', uploadedBy: 'other' })).toBe(true);
    expect(canAnnotatePhoto({ ...actor, isAdmin: true, projectRole: null })).toBe(true);
  });
});
