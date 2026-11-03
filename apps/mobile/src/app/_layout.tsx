import { Stack, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../providers/auth';
import { rememberReturnPath, safeReturnPath } from '../lib/auth-callback';
import { ConnectionProvider, useConnection } from '../providers/connection';
import { ProjectSwitcher } from '../components/project-switcher';

function Navigation() {
  const connection = useConnection();
  const { session, profile, loading, error, signOut, refreshProfile } = useAuth();
  const pathname = usePathname();
  useEffect(() => {
    const path = safeReturnPath(pathname);
    if (!session && path !== '/') rememberReturnPath(path);
  }, [pathname, session]);

  if (session && !loading && (!profile || !profile.is_active)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Account unavailable</Text>
        <Text accessibilityRole="alert" style={styles.body}>
          {error ?? 'Unable to load your account.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            void refreshProfile();
          }}
        >
          <Text style={styles.buttonText}>Retry account</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => {
            void signOut().catch(() => {});
          }}
        >
          <Text style={styles.buttonText}>Sign out</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: connection.busy }}
          disabled={connection.busy}
          style={styles.button}
          onPress={() => void connection.resetSession()}
        >
          <Text style={styles.buttonText}>Change app URL</Text>
        </Pressable>
        {connection.error && (
          <Text accessibilityRole="alert" style={styles.body}>
            {connection.error}
          </Text>
        )}
      </View>
    );
  }
  return (
    <View style={styles.root}>
      {error && session && profile?.is_active && (
        <View style={styles.banner}>
          <Text accessibilityRole="alert" style={styles.body}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            disabled={loading}
            style={styles.retry}
            onPress={() => {
              void refreshProfile();
            }}
          >
            <Text style={styles.retryText}>{loading ? 'Retrying…' : 'Retry account refresh'}</Text>
          </Pressable>
        </View>
      )}
      <Stack
        key={session?.user.id ?? 'anonymous'}
        screenOptions={{
          headerStyle: { backgroundColor: '#203d2c' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#f6f7f4' },
          headerRight: () =>
            session &&
            profile?.is_active &&
            (pathname.startsWith('/projects/') || pathname.startsWith('/snags/')) ? (
              <ProjectSwitcher />
            ) : null,
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/callback" options={{ title: 'Sign in' }} />
        <Stack.Protected
          guard={!!session && !!profile?.is_active}
          redirectTo={{ pathname: '/login', params: { returnTo: safeReturnPath(pathname) } }}
        >
          <Stack.Screen name="index" options={{ title: 'SnagFlow' }} />
          <Stack.Screen name="projects/[id]" options={{ title: 'Project' }} />
          <Stack.Screen name="snags/[id]" options={{ title: 'Snag' }} />
          <Stack.Screen name="projects/[id]/capture" options={{ title: 'Capture snag' }} />
          <Stack.Screen name="projects/[id]/reports" options={{ title: 'Reports' }} />
          <Stack.Screen name="notifications" options={{ title: 'Updates' }} />
        </Stack.Protected>
      </Stack>
      {loading && !profile && (
        <View
          style={styles.loading}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading your session"
        >
          <ActivityIndicator size="large" color="#c2410c" />
          <Text style={styles.body}>Loading your account…</Text>
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConnectionProvider>
        <ConnectionRoot />
      </ConnectionProvider>
    </SafeAreaProvider>
  );
}

function ConnectionRoot() {
  const { ready, identity } = useConnection();
  if (!ready)
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#c2410c" accessibilityLabel="Restoring app connection" />
        <Text style={styles.body}>Restoring app connection…</Text>
      </View>
    );
  return (
    <AuthProvider key={identity}>
      <Navigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 18, backgroundColor: '#f6f7f4' },
  title: { color: '#202b26', fontSize: 26, fontWeight: '700' },
  body: { color: '#58675e', fontSize: 16, lineHeight: 24 },
  button: {
    minHeight: 48,
    backgroundColor: '#203d2c',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  banner: {
    backgroundColor: '#fff1e8',
    padding: 12,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: '#d4dcd2',
  },
  retry: { minHeight: 48, justifyContent: 'center' },
  retryText: { color: '#9a3412', fontSize: 16, fontWeight: '600' },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#f6f7f4',
  },
});
