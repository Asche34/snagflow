import { useState } from 'react';
import { isReviewer } from '@snagflow/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '../providers/auth';
import { useConnection } from '../providers/connection';
import { useResource } from '../lib/use-resource';
import { listSnags } from '../lib/data';
import { readPages } from '../lib/online';
import { Button, Choices, ErrorText, Loading, Screen, styles } from '../components/ui';
import { SnagList } from '../components/snag-list';
export default function Home() {
  const { client: supabase, session, profile, signOut } = useAuth();
  const connection = useConnection();
  const [mode, setMode] = useState<'mine' | 'review'>('mine');
  const [page, setPage] = useState(0);
  const userId = session?.user.id ?? '';
  const resource = useResource(
    async () => {
      const [projects, memberships] = await Promise.all([
        readPages(async (from, to) => {
          const r = await supabase
            .from('projects')
            .select('*')
            .eq('status', 'active')
            .order('updated_at', { ascending: false })
            .order('id')
            .range(from, to);
          if (r.error) throw r.error;
          return r.data;
        }),
        readPages(async (from, to) => {
          const r = await supabase
            .from('project_members')
            .select('*')
            .eq('user_id', userId)
            .order('project_id')
            .range(from, to);
          if (r.error) throw r.error;
          return r.data;
        }),
      ]);
      const managed = memberships
        .filter((m) => isReviewer({ isAdmin: !!profile?.is_admin, projectRole: m.role }))
        .map((m) => m.project_id);
      let query = supabase
        .from('snags')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .in(
          'project_id',
          projects.map((p) => p.id),
        );
      if (mode === 'mine') query = query.eq('assignee_id', userId).neq('status', 'closed');
      else {
        query = query.eq('status', 'ready_for_review');
        if (!profile?.is_admin) query = query.in('project_id', managed);
      }
      const snags =
        mode === 'mine'
          ? await listSnags(
              null,
              { mine: userId, projectIds: projects.map((p) => p.id) },
              page,
              supabase,
            )
          : await (async () => {
              const r = await query
                .order('updated_at', { ascending: false })
                .order('id')
                .range(page * 50, page * 50 + 49);
              if (r.error) throw r.error;
              return { rows: r.data, count: r.count ?? 0 };
            })();
      return { projects, snags, canReview: !!profile?.is_admin || managed.length > 0 };
    },
    `home:${userId}:${mode}:${page}`,
    ['snags', 'project_members', 'projects'],
  );
  return (
    <Screen
      title="Fieldwork"
      refresh={() => void resource.refresh()}
      refreshing={resource.loading && !!resource.data}
    >
      <Text style={styles.muted}>SnagFlow · {profile?.full_name}</Text>
      <View style={styles.row}>
        <Button label="Notifications" secondary onPress={() => router.push('/notifications')} />
        <Button label="Sign out" secondary onPress={() => void signOut()} />
        <Button
          label="Change app URL"
          secondary
          disabled={connection.busy}
          onPress={() => void connection.resetSession()}
        />
      </View>
      <Text style={styles.text}>Online mode · pull to refresh. Changes require a connection.</Text>
      <ErrorText error={resource.error} />
      <ErrorText error={connection.error} />
      {resource.error && <Button label="Retry" onPress={() => void resource.refresh()} />}
      {resource.loading && !resource.data && <Loading />}
      {resource.data && (
        <>
          <Choices
            label="Your work"
            value={mode}
            options={[
              { value: 'mine', label: 'Assigned to me' },
              ...(resource.data.canReview
                ? [{ value: 'review' as const, label: 'Ready for review' }]
                : []),
            ]}
            onChange={(v) => {
              setMode(v);
              setPage(0);
            }}
          />
          <SnagList rows={resource.data.snags.rows} />
          <View style={styles.row}>
            <Button
              label="Previous"
              disabled={page === 0}
              secondary
              onPress={() => setPage((p) => p - 1)}
            />
            <Button
              label="Next"
              disabled={(page + 1) * 50 >= resource.data.snags.count}
              secondary
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
          <Text style={styles.heading}>Projects</Text>
          {resource.data.projects.map((project) => (
            <View key={project.id} style={styles.card}>
              <Text style={styles.muted}>{project.code}</Text>
              <Text style={styles.title}>{project.name}</Text>
              <Button
                label={`Open ${project.name}`}
                secondary
                onPress={() =>
                  router.push({ pathname: '/projects/[id]', params: { id: project.id } })
                }
              />
            </View>
          ))}
          {!resource.data.projects.length && (
            <Text style={styles.muted}>
              No active projects. Ask your project manager for access.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}
