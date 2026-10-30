import { createClient } from '@/lib/supabase/server';
import type { Location, Category } from '@/lib/data';

/** Project-scoped pagination avoids the workspace's global 1,000-row cap. */
export async function loadProjectMetadata(
  projectId: string,
): Promise<{ locations: Location[]; categories: Category[] }> {
  const client = await createClient();
  async function read<T>(
    fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ) {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await fetchPage(offset);
      if (result.error || !result.data) throw new Error('Project metadata could not be loaded.');
      rows.push(...result.data);
      if (result.data.length < 500) break;
    }
    return rows;
  }
  const [locations, categories] = await Promise.all([
    read((offset) =>
      client
        .from('locations')
        .select('*')
        .eq('project_id', projectId)
        .order('id')
        .range(offset, offset + 499),
    ),
    read((offset) =>
      client
        .from('categories')
        .select('*')
        .eq('project_id', projectId)
        .order('id')
        .range(offset, offset + 499),
    ),
  ]);
  return {
    locations: locations.sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    ),
    categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
