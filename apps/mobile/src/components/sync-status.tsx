import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname, type Href } from 'expo-router';
import { useOfflineRuntime, useOfflineState } from '../providers/offline';

/** Quiet field feedback; timestamps, failures and recovery actions live on Sync. */
export function SyncStatus() {
  const runtime = useOfflineRuntime();
  const state = useOfflineState();
  const pathname = usePathname();
  if (!runtime || pathname === '/sync' || pathname.startsWith('/login')) return null;
  const count = state?.queue.length ?? 0;
  const attention = state?.queue.some((q) => q.state === 'attention');
  const projectId = /^\/projects\/([^/]+)/.exec(pathname)?.[1];
  const preparing = projectId && !state?.mirrors[projectId] && runtime.capability !== 'unsupported';
  const mode = runtime.capability === 'unsupported' ? 'Online only' : runtime.online ? 'Online' : 'Offline';
  const summary = attention ? `${count} changes need review` : preparing ? 'Preparing project…' : `${mode} · ${count} waiting`;
  return (
    <SafeAreaView edges={['bottom']} style={status.safe}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sync and queued work"
        accessibilityHint={`${summary}. View saved changes and sync details.`}
        onPress={() => router.push('/sync' as Href)}
        style={({ pressed }) => [status.control, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={status.summary}>
          <View style={[status.dot, attention ? status.warning : runtime.online ? status.connected : status.disconnected]} />
          <Text style={status.text}>{summary}</Text>
        </View>
        <Text style={status.link}>{runtime.online && runtime.syncing && count > 0 ? 'Sending…' : 'Sync ›'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
const status = StyleSheet.create({
  safe: { backgroundColor: '#f6f7f4', borderTopWidth: 1, borderTopColor: '#d4dcd2' },
  control: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connected: { backgroundColor: '#203d2c' },
  disconnected: { backgroundColor: '#58675e' },
  warning: { backgroundColor: '#9a3412' },
  text: { color: '#39483f', fontSize: 13, flexShrink: 1 },
  link: { color: '#203d2c', fontSize: 13, fontWeight: '600' },
});
