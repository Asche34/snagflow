import { z } from 'zod';
import type { ProjectRole } from './roles';

const coordinate = z.number().finite().min(0).max(16000);
const base = {
  id: z.string().uuid(),
  x: coordinate,
  y: coordinate,
  width: z.number().finite().min(1).max(16000),
  height: z.number().finite().min(1).max(16000),
  colour: z.string().regex(/^#[0-9a-f]{6}$/i),
  strokeWidth: z.number().finite().min(1).max(40),
};
const label = { text: z.string().trim().min(1).max(200), fontSize: z.number().finite().min(8).max(160) };
const AnnotationObjectSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('pen'), points: z.array(coordinate).min(4).max(4000) }).strict(),
  z.object({ ...base, type: z.literal('arrow'), points: z.array(coordinate).length(4) }).strict(),
  z.object({ ...base, type: z.literal('rectangle') }).strict(),
  z.object({ ...base, type: z.literal('circle') }).strict(),
  z.object({ ...base, ...label, type: z.literal('text') }).strict(),
  z.object({ ...base, ...label, type: z.literal('measurement') }).strict(),
]);

/** Pixel coordinates always refer to the original image, independent of display size. */
export const AnnotationDocumentSchema = z.object({
  version: z.literal(1),
  width: z.number().int().min(1).max(16000),
  height: z.number().int().min(1).max(16000),
  objects: z.array(AnnotationObjectSchema).max(200),
}).strict().superRefine((document, context) => {
  const ids = new Set<string>();
  for (const [index, object] of document.objects.entries()) {
    if (ids.has(object.id) || object.x + object.width > document.width || object.y + object.height > document.height) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['objects', index], message: 'Object identity or position is invalid.' });
    }
    ids.add(object.id);
    if ('points' in object && (object.points.length % 2 !== 0 || object.points.some((point, offset) => point > (offset % 2 === 0 ? object.width : object.height)))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['objects', index, 'points'], message: 'Points must fit the object bounds.' });
    }
  }
  if (JSON.stringify(document).length > 256000) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'The annotation document is too large.' });
  }
});

export type AnnotationDocument = z.infer<typeof AnnotationDocumentSchema>;
export type AnnotationObject = AnnotationDocument['objects'][number];

export function moveAnnotation<T extends AnnotationObject>(object: T, dx: number, dy: number, width: number, height: number): T {
  return { ...object, x: Math.max(0, Math.min(width - object.width, object.x + dx)), y: Math.max(0, Math.min(height - object.height, object.y + dy)) };
}

/** Mirrored by save_photo_annotation: reviewers or the still-member original uploader. */
export function canAnnotatePhoto(actor: { id: string; isAdmin: boolean; projectRole: ProjectRole | null; uploadedBy: string }): boolean {
  return actor.isAdmin || actor.projectRole === 'manager' || (actor.projectRole === 'member' && actor.id === actor.uploadedBy);
}
