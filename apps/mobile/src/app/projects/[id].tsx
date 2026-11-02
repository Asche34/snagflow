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
  const { session, profile } = useAuth();
  const [filters, setFilters] = useState<SnagFilters>({});
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [due, setDue] = useState('');
  const set = (value: SnagFilters) => {
    setFilters((v) => ({ ...v, ...value }));
    setPage(0);
  };
  const r = useResource(
    async () => ({
      context: await projectContext(id, session!.user.id),
      snags: await listSnags(id, filters, page),
    }),
    `project:${id}:${JSON.stringify(filters)}:${page}`,
    ['snags', 'project_members', 'projects', 'locations', 'categories'],
  );
  const actor =
    session && profile?.is_active ? { id: session.user.id, isAdmin: profile.is_admin } : null;
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
            onSubmitEditing={() => set({ search: query })}
          />
          <Button label="Search" secondary onPress={() => set({ search: query })} />
          <Choices
            label="Status"
            value={filters.status ?? ''}
            options={[
              { value: '', label: 'All' },
              ...SNAG_STATUSES.map((value) => ({ value, label: human(value) })),
            ]}
            onChange={(status) => set({ status })}
          />
          <Choices
            label="Priority"
            value={filters.priority ?? ''}
            options={[
              { value: '', label: 'All' },
              ...SNAG_PRIORITIES.map((value) => ({ value, label: value })),
            ]}
            onChange={(priority) => set({ priority })}
          />
          <Choices
            label="Location"
            value={filters.location ?? ''}
            options={[
              { value: '', label: 'All' },
              ...r.data.context.locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
            onChange={(location) => set({ location })}
          />
          <Choices
            label="Category"
            value={filters.category ?? ''}
            options={[
              { value: '', label: 'All' },
              ...r.data.context.categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
            onChange={(category) => set({ category })}
          />
          <Choices
            label="Assignee"
            value={filters.assignee ?? ''}
            options={[
              { value: '', label: 'All' },
              ...r.data.context.members.map((m) => ({
                value: m.user_id,
                label: m.profiles?.full_name ?? m.user_id,
              })),
            ]}
            onChange={(assignee) => set({ assignee })}
          />
          <Button
            label={filters.createdBy ? 'Show all creators' : 'Created by me'}
            secondary
            onPress={() => set({ createdBy: filters.createdBy ? undefined : session!.user.id })}
          />
          <Field label="Due on or before (YYYY-MM-DD)" value={due} onChangeText={setDue} />
          <Button
            label="Apply due filter"
            secondary
            onPress={() => {
              if (!due || /^\d{4}-\d{2}-\d{2}$/.test(due)) set({ dueBefore: due });
            }}
          />
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
