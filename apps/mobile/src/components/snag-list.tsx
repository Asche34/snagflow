import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Button, human, styles } from './ui';
import type { Row } from '../lib/data';
export function SnagList({ rows }: { rows: Row<'snags'>[] }) {
  return (
    <View style={{ gap: 12 }}>
      {rows.length ? (
        rows.map((snag) => (
          <View key={snag.id} style={styles.card}>
            <Text style={styles.muted}>
              #{snag.number} · {human(snag.status)} · {snag.priority}
            </Text>
            <Text style={styles.title}>{snag.title}</Text>
            {snag.due_date && <Text style={styles.muted}>Due {snag.due_date}</Text>}
            <Button
              label={`Open snag #${snag.number}`}
              onPress={() => router.push({ pathname: '/snags/[id]', params: { id: snag.id } })}
              secondary
            />
          </View>
        ))
      ) : (
        <Text style={styles.muted}>No snags in this view.</Text>
      )}
    </View>
  );
}
