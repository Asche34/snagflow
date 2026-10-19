import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';

/**
 * Phase 0 placeholder layout. Replaced by the real SnagFlow navigation stack
 * (auth guard + tabs) in Phase 5.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={styles.container}>
        <Text style={styles.title}>SnagFlow</Text>
        <Text style={styles.subtitle}>Mobile app scaffold — auth and sync arrive in Phase 5.</Text>
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#433dce',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
});
