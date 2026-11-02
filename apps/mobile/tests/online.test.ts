import { describe, expect, it } from 'vitest';
import {
  dimensions,
  searchIntent,
  stableWrite,
  readPages,
  retainedResource,
  AccessUnavailableError,
} from '../src/lib/online';

describe('online operations', () => {
  it('keeps editable resources mounted after a temporary read failure', () => {
    const draft = { id: 'photo', title: 'Retained form' };
    expect(retainedResource(draft, new TypeError('Network request failed'))).toBe(draft);
  });
  it('clears private resources when access is proven unavailable', () => {
    expect(retainedResource({ id: 'photo' }, new AccessUnavailableError())).toBeNull();
    expect(retainedResource({ id: 'photo' }, { code: '42501' })).toBeNull();
  });
  it('fits portrait and landscape without enlargement or cropping', () => {
    expect(dimensions(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(dimensions(4000, 3000, 400)).toEqual({ width: 400, height: 300 });
    expect(dimensions(120, 80, 1600)).toEqual({ width: 120, height: 80 });
    expect(() => dimensions(0, 20, 400)).toThrow();
  });
  it('distinguishes exact snag numbers from English full text', () => {
    expect(searchIntent(' #24 ')).toEqual({ number: 24 });
    expect(searchIntent('leaking wall')).toEqual({ text: 'leaking wall' });
    expect(searchIntent('')).toEqual({});
    expect(searchIntent('#99999999999999999999999999')).toEqual({ number: 0 });
  });
  it('reconciles a lost committed insert before reporting failure', async () => {
    let committed: { id: string } | null = null;
    expect(
      await stableWrite(
        async () => committed,
        async () => {
          committed = { id: 'same' };
          throw Error('response lost');
        },
      ),
    ).toEqual({ id: 'same' });
  });
  it('does not mask a denied uncommitted insert', async () => {
    await expect(
      stableWrite(
        async () => null,
        async () => {
          throw Error('denied');
        },
      ),
    ).rejects.toThrow('denied');
  });
  it('never repeats a committed insert', async () => {
    expect(
      await stableWrite(
        async () => ({ id: 'same' }),
        async () => {
          throw Error('duplicate');
        },
      ),
    ).toEqual({ id: 'same' });
  });
  it('reads beyond the backend row cap and propagates errors', async () => {
    const rows = Array.from({ length: 1207 }, (_, id) => ({ id }));
    expect(await readPages(async (from, to) => rows.slice(from, to + 1))).toEqual(rows);
    await expect(
      readPages(async () => {
        throw Error('access');
      }),
    ).rejects.toThrow('access');
  });
});
