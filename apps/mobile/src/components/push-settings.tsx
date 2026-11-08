import { Platform, Text, View } from 'react-native';
import { usePush } from '../providers/push';
import { Button, ErrorText, styles } from './ui';
export function PushSettings() {
  const push = usePush();
  if (Platform.OS === 'web') return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Phone notifications</Text>
      <Text style={styles.muted}>
        {push.enabled
          ? 'This account is registered for push updates. Server delivery also requires administrator setup.'
          : 'Enable assignment, review and comment alerts on this phone. In-app Updates are always available.'}
      </Text>
      <ErrorText error={push.error} />
      <Button
        label={
          push.busy
            ? 'Updating notifications…'
            : push.enabled
              ? 'Disable phone notifications'
              : 'Enable phone notifications'
        }
        disabled={push.busy}
        secondary
        onPress={() => void (push.enabled ? push.disable() : push.enable())}
      />
    </View>
  );
}
