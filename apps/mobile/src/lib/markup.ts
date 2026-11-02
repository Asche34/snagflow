import {
  AnnotationDocumentSchema,
  moveAnnotation,
  type AnnotationDocument,
  type AnnotationObject,
} from '@snagflow/shared';

export type MarkupTool = AnnotationObject['type'];
export type MarkupHistory = {
  current: AnnotationDocument;
  undo: AnnotationDocument[];
  redo: AnnotationDocument[];
};
type Edit = { type: 'commit'; objects: AnnotationObject[] } | { type: 'undo' | 'redo' };

/** View touches are converted once; vector data always stays in original-image pixels. */
export function documentPoint(
  x: number,
  y: number,
  viewWidth: number,
  document: AnnotationDocument,
): [number, number] | null {
  if (!Number.isFinite(viewWidth) || viewWidth <= 0 || !Number.isFinite(x) || !Number.isFinite(y))
    return null;
  const scale = viewWidth / document.width;
  return [
    Math.max(0, Math.min(document.width - 1, x / scale)),
    Math.max(0, Math.min(document.height - 1, y / scale)),
  ];
}

export function createMarkupObject(
  document: AnnotationDocument,
  type: MarkupTool,
  input: number[],
  id: string,
  colour: string,
  text = '',
): AnnotationObject {
  if (
    input.length < 4 ||
    input.length % 2 ||
    input.length > 4000 ||
    input.some((point) => !Number.isFinite(point))
  ) {
    throw new Error('This stroke is invalid or too long. Try a shorter stroke.');
  }
  const points = input.map((value, index) =>
    Math.max(0, Math.min((index % 2 ? document.height : document.width) - 1, value)),
  );
  const xs = points.filter((_, index) => index % 2 === 0),
    ys = points.filter((_, index) => index % 2 === 1);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  const base = {
    id,
    x,
    y,
    width: Math.max(1, Math.max(...xs) - x),
    height: Math.max(1, Math.max(...ys) - y),
    colour,
    strokeWidth: Math.max(1, Math.min(6, Math.round(document.width / 300))),
  };
  let object: AnnotationObject;
  if (type === 'pen' || type === 'arrow') {
    const local = (type === 'arrow' ? [...points.slice(0, 2), ...points.slice(-2)] : points).map(
      (value, index) => value - (index % 2 ? y : x),
    );
    object = { ...base, type, points: local };
  } else if (type === 'text' || type === 'measurement') {
    object = {
      ...base,
      type,
      text: text.trim(),
      fontSize: Math.max(8, Math.min(32, Math.round(document.width / 40))),
    };
  } else object = { ...base, type };
  if (!AnnotationDocumentSchema.safeParse({ ...document, objects: [object] }).success)
    throw new Error('Use a valid colour and a note between 1 and 200 characters.');
  return object;
}

export function editHistory(history: MarkupHistory, edit: Edit): MarkupHistory {
  if (edit.type === 'commit') {
    const result = AnnotationDocumentSchema.safeParse({
      ...history.current,
      objects: edit.objects,
    });
    if (!result.success)
      throw new Error(
        'This draft exceeds the markup limit. Remove objects or use a shorter stroke or note.',
      );
    return { current: result.data, undo: [...history.undo.slice(-49), history.current], redo: [] };
  }
  const source = history[edit.type];
  const current = source.at(-1);
  if (!current) return history;
  return edit.type === 'undo'
    ? {
        current,
        undo: history.undo.slice(0, -1),
        redo: [...history.redo.slice(-49), history.current],
      }
    : {
        current,
        undo: [...history.undo.slice(-49), history.current],
        redo: history.redo.slice(0, -1),
      };
}

export function moveMarkup(
  document: AnnotationDocument,
  id: string,
  dx: number,
  dy: number,
): AnnotationDocument {
  return {
    ...document,
    objects: document.objects.map((object) =>
      object.id === id ? moveAnnotation(object, dx, dy, document.width, document.height) : object,
    ),
  };
}

export function hitMarkup(document: AnnotationDocument, [x, y]: [number, number]): string | null {
  return (
    [...document.objects]
      .reverse()
      .find(
        (object) =>
          x >= object.x &&
          x <= object.x + object.width &&
          y >= object.y &&
          y <= object.y + object.height,
      )?.id ?? null
  );
}
