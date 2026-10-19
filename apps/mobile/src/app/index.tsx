import { StyleSheet, Text, View } from 'react-native';

/**
 * Phase 0 placeholder screen. The live sign-in screen replaces this in Phase 5.
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>SnagFlow mobile</Text>
      <Text style={styles.body}>
        Scaffold only. Sign-in, project list and the offline-capable snag flow land in Phase 5.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
  },
  body: {
    textAlign: 'center',
    opacity: 0.7,
    maxWidth: 320,
  },
});
