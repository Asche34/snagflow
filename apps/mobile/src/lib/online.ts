/** Online request primitives. Nothing here persists an offline queue. */
export class AccessUnavailableError extends Error {
  constructor() {
    super('This record is unavailable or your access changed.');
  }
}
export function retainedResource<T>(previous: T | null, failure: unknown): T | null {
  const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : null;
  return failure instanceof AccessUnavailableError || code === '42501' || code === 'PGRST116'
    ? null
    : previous;
}
export function dimensions(width: number, height: number, limit: number) {
  if (![width, height, limit].every((value) => Number.isFinite(value) && value > 0))
    throw Error('Invalid image dimensions.');
  const scale = Math.min(1, limit / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
export function searchIntent(value: string): { number?: number; text?: string } {
  const text = value.trim().slice(0, 200);
  if (/^#?\d+$/.test(text)) {
    const number = Number(text.replace('#', ''));
    return { number: number > 0 && number <= 2147483647 ? number : 0 };
  }
  return text ? { text } : {};
}
export async function stableWrite<T>(
  read: () => Promise<T | null>,
  insert: () => Promise<T>,
): Promise<T> {
  const existing = await read();
  if (existing) return existing;
  try {
    return await insert();
  } catch (error) {
    const committed = await read();
    if (committed) return committed;
    throw error;
  }
}
export async function readPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const page = await fetchPage(from, from + 499);
    rows.push(...page);
    if (page.length < 500) return rows;
    if (rows.length >= 20000) throw Error('This list is too large. Narrow the project scope.');
  }
}
