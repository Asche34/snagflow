import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../providers/auth';
import { supabase } from '../lib/supabase';
import { useResource } from '../lib/use-resource';
import { Button, ErrorText, human, Loading, Screen, styles } from '../components/ui';
export default function Notifications() {
  const { session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const r = useResource(
    async () => {
      const [items, unread] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', session!.user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('notifications')
          .select('id', { head: true, count: 'exact' })
          .eq('user_id', session!.user.id)
          .is('read_at', null),
      ]);
      if (items.error) throw items.error;
      if (unread.error) throw unread.error;
      return { items: items.data, count: unread.count ?? 0 };
    },
    `notifications:${session!.user.id}`,
    ['notifications'],
  );
  const mark = async (id?: string) => {
    setBusy(true);
    setError(null);
    try {
      let q = supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', session!.user.id)
        .is('read_at', null);
      if (id) q = q.eq('id', id);
      const result = await q;
      if (result.error) throw result.error;
      await r.refresh();
    } catch {
      setError('Could not mark notifications read. Retry.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      title="Notifications"
      refresh={() => void r.refresh()}
      refreshing={r.loading && !!r.data}
    >
      <ErrorText error={r.error ?? error} />
      {r.loading && !r.data && <Loading />}
      {r.error && <Button label="Retry" onPress={() => void r.refresh()} />}
      {r.data && (
        <>
          <Text style={styles.text}>{r.data.count} unread · latest 30</Text>
          <Button
            label="Mark all read"
            secondary
            disabled={busy || !r.data.count}
            onPress={() => void mark()}
          />
          {r.data.items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.title}>{human(item.type)}</Text>
              <Text style={styles.muted}>
                {new Date(item.created_at).toLocaleString()} · {item.read_at ? 'Read' : 'Unread'}
              </Text>
              {item.snag_id && (
                <Button
                  label="Open snag"
                  secondary
                  onPress={() =>
                    router.push({ pathname: '/snags/[id]', params: { id: item.snag_id! } })
                  }
                />
              )}
              {!item.read_at && (
                <Button
                  label="Mark read"
                  secondary
                  disabled={busy}
                  onPress={() => void mark(item.id)}
                />
              )}
            </View>
          ))}
          {!r.data.items.length && <Text style={styles.muted}>No notifications yet.</Text>}
        </>
      )}
    </Screen>
  );
}
