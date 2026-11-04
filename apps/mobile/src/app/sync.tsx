import { Text, View } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useOffline, useOfflineState } from '../providers/offline';
import { Button, ErrorText, Screen, styles } from '../components/ui';
import { definitiveConflict } from '../lib/offline/engine';
export default function Sync() {
  const offline = useOffline();
  const state = useOfflineState();
  const [error, setError] = useState<string | null>(null);
  if (!offline)
    return (
      <Screen title="Sync">
        <Text style={styles.text}>Sign in to view this account’s queued work.</Text>
      </Screen>
    );
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      setError(null);
    } catch {
      setError('The local change could not be saved. Retry.');
    }
  };
  return (
    <Screen
      title="Sync and queued work"
      refresh={() => void offline.sync()}
      refreshing={offline.syncing}
    >
      <ErrorText error={error ?? offline.error} />
      <Text style={styles.text}>
        Queued work stays with this account and app URL. Reconnecting rechecks access before sending
        it. Review server changes before retrying a conflict.
      </Text>
      <Button label="Sync now" disabled={offline.syncing} onPress={() => void offline.sync()} />
      {!state?.queue.length && <Text style={styles.muted}>No queued changes.</Text>}
      {state?.queue.map((q) => (
        <View key={q.id} style={styles.card}>
          <Text style={styles.title}>
            {q.kind} · {q.state === 'attention' ? 'Needs attention' : 'Pending'}
          </Text>
          <Text style={styles.muted}>
            Project {offline.engine.state.mirrors[q.projectId]?.project.name ?? 'unavailable'} ·{' '}
            {new Date(q.createdAt).toLocaleString()} · {q.attempts} attempts
          </Text>
          <Text style={styles.text}>{JSON.stringify(q.payload)}</Text>
          {q.photos?.map((p) => (
            <Text key={p.id} style={styles.muted}>
              Photo {p.id} · {p.status}
            </Text>
          ))}
          <ErrorText error={q.error ?? null} />
          <Button
            label="Review current snag"
            secondary
            onPress={() => router.push({ pathname: '/snags/[id]', params: { id: q.snagId } })}
          />
          <Button
            label={
              q.state === 'attention' ? 'Retry intent against current server version' : 'Retry now'
            }
            secondary
            onPress={() =>
              void run(async () => {
                // A conflict retry is a NEW operation; an old receipt must retain its original fingerprint.
                if (
                  q.state === 'attention' &&
                  definitiveConflict(q.error) &&
                  q.kind === 'annotation'
                ) {
                  const current = await offline.client
                    .from('snag_photos')
                    .select('updated_at')
                    .eq('id', q.photos![0]!.id)
                    .single();
                  if (current.error) throw current.error;
                  await offline.engine.change((s) => {
                    const op = s.queue.find((o) => o.id === q.id);
                    if (op) {
                      op.id = randomUUID();
                      op.payload.expected_updated_at = current.data.updated_at;
                      op.state = 'queued';
                      op.nextAttemptAt = 0;
                      op.error = undefined;
                    }
                  });
                } else if (
                  q.state === 'attention' &&
                  definitiveConflict(q.error) &&
                  q.kind !== 'create' &&
                  q.kind !== 'photos'
                ) {
                  const current = await offline.client
                    .from('snags')
                    .select('updated_at')
                    .eq('id', q.snagId)
                    .single();
                  if (current.error) throw current.error;
                  await offline.engine.change((s) => {
                    const op = s.queue.find((o) => o.id === q.id);
                    if (op) {
                      op.id = randomUUID();
                      op.expectedUpdatedAt = current.data.updated_at;
                      op.state = 'queued';
                      op.nextAttemptAt = 0;
                      op.error = undefined;
                    }
                  });
                } else await offline.engine.retry(q.id);
                await offline.sync();
              })
            }
          />
          <Button
            label="Discard queued change"
            secondary
            onPress={() => void run(() => offline.engine.discard(q.id))}
          />
        </View>
      ))}
    </Screen>
  );
}
