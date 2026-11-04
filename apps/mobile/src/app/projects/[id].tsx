import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { canAct, SNAG_STATUSES, SNAG_PRIORITIES } from '@snagflow/shared';
import { useAuth } from '../../providers/auth';
import { listSnags, projectContext, type SnagFilters } from '../../lib/data';
import { useResource } from '../../lib/use-resource';
import {
  Button,
  Choices,
  ErrorText,
  Field,
  human,
  Loading,
  Screen,
  styles,
} from '../../components/ui';
import { SnagList } from '../../components/snag-list';
export default function Project() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectScreen key={id} id={id} />;
}
function ProjectScreen({ id }: { id: string }) {
  const { client: supabase, session, profile } = useAuth();
  const [filters, setFilters] = useState<SnagFilters>({});
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [due, setDue] = useState('');
  const [draft, setDraft] = useState<SnagFilters | null>(null);
  const set = (value: SnagFilters) => {
    setFilters((v) => ({ ...v, ...value }));
    setPage(0);
  };
  const updateDraft = (value: SnagFilters) => setDraft((previous) => ({ ...previous, ...value }));
  const r = useResource(
    async () => ({
      context: await projectContext(id, session!.user.id, supabase),
      snags: await listSnags(id, filters, page, supabase),
    }),
    `project:${id}:${JSON.stringify(filters)}:${page}`,
    ['snags', 'project_members', 'projects', 'locations', 'categories'],
  );
  const actor =
    session && profile?.is_active ? { id: session.user.id, isAdmin: profile.is_admin } : null;
  const context = r.data?.context;
  const activeFilters: { key: keyof SnagFilters; label: string }[] = [];
  if (filters.search) activeFilters.push({ key: 'search', label: filters.search });
  if (filters.status) activeFilters.push({ key: 'status', label: human(filters.status) });
  if (filters.priority) activeFilters.push({ key: 'priority', label: human(filters.priority) });
  if (filters.location)
    activeFilters.push({
      key: 'location',
      label: context?.locations.find((item) => item.id === filters.location)?.name ?? 'Location',
    });
  if (filters.category)
    activeFilters.push({
      key: 'category',
      label: context?.categories.find((item) => item.id === filters.category)?.name ?? 'Category',
    });
  if (filters.assignee)
    activeFilters.push({
      key: 'assignee',
      label:
        context?.members.find((item) => item.user_id === filters.assignee)?.profiles?.full_name ??
        'Assignee',
    });
  if (filters.createdBy) activeFilters.push({ key: 'createdBy', label: 'Created by me' });
  if (filters.dueBefore)
    activeFilters.push({ key: 'dueBefore', label: 'Due by ' + filters.dueBefore });
  const filterCount = activeFilters.filter((item) => item.key !== 'search').length;

  return (
    <Screen
      title={r.data?.context.project.name ?? 'Project'}
      refresh={() => void r.refresh()}
      refreshing={r.loading && !!r.data}
    >
      <ErrorText error={r.error} />
      {r.error && <Button label="Retry" onPress={() => void r.refresh()} />}
      {r.loading && !r.data && <Loading />}
      {r.data && (
        <>
          <Text style={styles.muted}>
            {r.data.context.project.code} · {r.data.snags.count} matching snags
          </Text>
          <View style={styles.row}>
            {canAct(actor, r.data.context.role, 'snag:create') && (
              <Button
                label="Capture snag"
                onPress={() => router.push({ pathname: '/projects/[id]/capture', params: { id } })}
              />
            )}
            {canAct(actor, r.data.context.role, 'report:generate') && (
              <Button
                label="Reports"
                secondary
                onPress={() => router.push({ pathname: '/projects/[id]/reports', params: { id } })}
              />
            )}
          </View>
          <Field
            label="Search title, description or #number"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => set({ search: query.trim() })}
          />
          <View style={styles.row}>
            <Button label="Search" secondary onPress={() => set({ search: query.trim() })} />
            <Button
              label={
                draft ? 'Hide filters' : filterCount ? 'Filters (' + filterCount + ')' : 'Filters'
              }
              secondary
              onPress={() => {
                setDue(filters.dueBefore ?? '');
                setDraft(draft ? null : filters);
              }}
            />
          </View>
          {activeFilters.length > 0 && (
            <View style={styles.row}>
              {activeFilters.map(({ key, label }) => (
                <Button
                  key={key}
                  label={label + ' ×'}
                  secondary
                  onPress={() => {
                    if (key === 'search') setQuery('');
                    if (key === 'dueBefore') setDue('');
                    setDraft(null);
                    set({ [key]: undefined });
                  }}
                />
              ))}
              <Button
                label="Clear all"
                secondary
                onPress={() => {
                  setFilters({});
                  setDraft(null);
                  setQuery('');
                  setDue('');
                  setPage(0);
                }}
              />
            </View>
          )}
          {draft && (
            <View style={styles.card}>
              <Text accessibilityRole="header" style={styles.title}>
                Filter snags
              </Text>
              <Choices
                label="Status"
                value={draft.status ?? ''}
                options={[
                  { value: '', label: 'All' },
                  ...SNAG_STATUSES.map((value) => ({ value, label: human(value) })),
                ]}
                onChange={(status) => updateDraft({ status })}
              />
              <Choices
                label="Priority"
                value={draft.priority ?? ''}
                options={[
                  { value: '', label: 'All' },
                  ...SNAG_PRIORITIES.map((value) => ({ value, label: value })),
                ]}
                onChange={(priority) => updateDraft({ priority })}
              />
              <Choices
                label="Location"
                value={draft.location ?? ''}
                options={[
                  { value: '', label: 'All' },
                  ...r.data.context.locations.map((l) => ({ value: l.id, label: l.name })),
                ]}
                onChange={(location) => updateDraft({ location })}
              />
              <Choices
                label="Category"
                value={draft.category ?? ''}
                options={[
                  { value: '', label: 'All' },
                  ...r.data.context.categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                onChange={(category) => updateDraft({ category })}
              />
              <Choices
                label="Assignee"
                value={draft.assignee ?? ''}
                options={[
                  { value: '', label: 'All' },
                  ...r.data.context.members.map((m) => ({
                    value: m.user_id,
                    label: m.profiles?.full_name ?? 'Project member',
                  })),
                ]}
                onChange={(assignee) => updateDraft({ assignee })}
              />
              <Button
                label={draft.createdBy ? 'Show all creators' : 'Created by me'}
                secondary
                onPress={() =>
                  updateDraft({ createdBy: draft.createdBy ? undefined : session!.user.id })
                }
              />
              <Field label="Due on or before (YYYY-MM-DD)" value={due} onChangeText={setDue} />
              <View style={styles.row}>
                <Button label="Cancel filters" secondary onPress={() => setDraft(null)} />
                <Button
                  label="Apply filters"
                  disabled={!!due && !/^\d{4}-\d{2}-\d{2}$/.test(due)}
                  onPress={() => {
                    set({ ...draft, search: filters.search, dueBefore: due || undefined });
                    setDraft(null);
                  }}
                />
              </View>
            </View>
          )}
          <SnagList rows={r.data.snags.rows} />
          <View style={styles.row}>
            <Button
              label="Previous"
              secondary
              disabled={!page}
              onPress={() => setPage((p) => p - 1)}
            />
            <Text style={styles.text}>Page {page + 1}</Text>
            <Button
              label="Next"
              secondary
              disabled={(page + 1) * 50 >= r.data.snags.count}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
