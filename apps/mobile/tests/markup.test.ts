import { describe, expect, it } from 'vitest';
import type { AnnotationDocument } from '@snagflow/shared';
import {
  createMarkupObject,
  documentPoint,
  editHistory,
  hitMarkup,
  moveMarkup,
  type MarkupHistory,
} from '../src/lib/markup';

const id = '5ad8ecbe-8f2d-4d0a-a323-ab1524641c63';
const blank: AnnotationDocument = { version: 1, width: 1600, height: 800, objects: [] };
const rectangle = {
  id,
  type: 'rectangle' as const,
  x: 100,
  y: 100,
  width: 400,
  height: 200,
  colour: '#c2410c',
  strokeWidth: 4,
};

describe('native original-pixel markup', () => {
  it('converts a scaled touch to original pixels and bounds edge touches', () => {
    expect(documentPoint(150, 75, 400, blank)).toEqual([600, 300]);
    expect(documentPoint(500, -10, 400, blank)).toEqual([1599, 0]);
    expect(documentPoint(0, 0, 0, blank)).toBeNull();
  });

  it('keeps a backwards arrow direction inside local object geometry', () => {
    expect(createMarkupObject(blank, 'arrow', [900, 500, 100, 100], id, '#c2410c')).toEqual({
      id,
      type: 'arrow',
      x: 100,
      y: 100,
      width: 800,
      height: 400,
      colour: '#c2410c',
      strokeWidth: 5,
      points: [800, 400, 0, 0],
    });
  });

  it('creates bounded edge shapes and rejects missing or oversized note text', () => {
    expect(
      createMarkupObject(blank, 'circle', [1600, 800, 1600, 800], id, '#c2410c'),
    ).toMatchObject({ x: 1599, y: 799, width: 1, height: 1 });
    expect(() =>
      createMarkupObject(blank, 'text', [100, 100, 400, 200], id, '#c2410c', ' '),
    ).toThrow();
    expect(() =>
      createMarkupObject(
        blank,
        'measurement',
        [100, 100, 400, 200],
        id,
        '#c2410c',
        'x'.repeat(201),
      ),
    ).toThrow();
    expect(
      createMarkupObject(blank, 'measurement', [100, 100, 400, 200], id, '#c2410c', '  120 mm  '),
    ).toMatchObject({ text: '120 mm', fontSize: 32 });
  });

  it('bounds freehand points and keeps all six tools compatible with the shared schema', () => {
    for (const type of ['pen', 'arrow', 'circle', 'rectangle', 'text', 'measurement'] as const) {
      const object = createMarkupObject(blank, type, [10, 20, 300, 150], id, '#c2410c', 'Note');
      expect(
        editHistory({ current: blank, undo: [], redo: [] }, { type: 'commit', objects: [object] })
          .current.objects[0]?.type,
      ).toBe(type);
    }
    expect(() =>
      createMarkupObject(
        blank,
        'pen',
        Array.from({ length: 4002 }, () => 1),
        id,
        '#c2410c',
      ),
    ).toThrow();
  });

  it('selects the last overlapping object and clamps movement without changing point geometry', () => {
    const arrow = createMarkupObject(blank, 'arrow', [900, 500, 100, 100], id, '#c2410c');
    expect(moveMarkup({ ...blank, objects: [arrow] }, id, 5000, -5000).objects[0]).toMatchObject({
      x: 800,
      y: 0,
      points: [800, 400, 0, 0],
    });
    expect(
      hitMarkup({ ...blank, objects: [rectangle, { ...rectangle, id: 'second' }] }, [200, 200]),
    ).toBe('second');
    expect(hitMarkup({ ...blank, objects: [rectangle] }, [800, 600])).toBeNull();
  });

  it('undoes deletion and drops redo when a new edit follows undo', () => {
    let history: MarkupHistory = { current: blank, undo: [], redo: [] };
    history = editHistory(history, { type: 'commit', objects: [rectangle] });
    history = editHistory(history, { type: 'commit', objects: [] });
    history = editHistory(history, { type: 'undo' });
    expect(history.current.objects).toEqual([rectangle]);
    expect(editHistory(history, { type: 'redo' }).current.objects).toEqual([]);
    history = editHistory(history, {
      type: 'commit',
      objects: [{ ...rectangle, colour: '#192d25' }],
    });
    expect(history.redo).toEqual([]);
    expect(editHistory(history, { type: 'undo' }).current.objects).toEqual([rectangle]);
  });

  it('rejects invalid document edits without mutating the retained draft', () => {
    const history = { current: blank, undo: [], redo: [] };
    expect(() =>
      editHistory(history, {
        type: 'commit',
        objects: Array.from({ length: 201 }, () => rectangle),
      }),
    ).toThrow();
    expect(history.current).toEqual(blank);
    expect(() =>
      createMarkupObject(blank, 'pen', [Number.NaN, 0, 10, 10], id, '#c2410c'),
    ).toThrow();
  });
});
