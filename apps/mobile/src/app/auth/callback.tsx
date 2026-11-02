import { router } from 'expo-router';
import type { Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { consumeReturnPath, exchangeAuthCallback } from '../../lib/auth-callback';
import { useAuth } from '../../providers/auth';

export default function AuthCallbackScreen() {
  const incomingUrl = Linking.useLinkingURL();
  const { client: supabase, session, profile } = useAuth();
  const started = useRef(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const url =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.href
            : (incomingUrl ?? (await Linking.getInitialURL()));
        if (!url) throw new Error('Missing sign-in link');
        const origin =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? window.location.origin
            : undefined;
        await exchangeAuthCallback(
          url,
          (code) => supabase.auth.exchangeCodeForSession(code),
          origin,
        );
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session) throw new Error('Session unavailable');
        setCompleted(true);
      } catch {
        setError('Unable to use this sign-in link. Request a new sign-in link on this device.');
      }
    })();
  }, [incomingUrl, supabase]);

  useEffect(() => {
    if (completed && session && profile?.is_active) router.replace(consumeReturnPath() as Href);
  }, [completed, session, profile]);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{error ? 'Link unavailable' : 'Signing you in'}</Text>
      {error ? (
        <>
          <Text accessibilityRole="alert" style={styles.body}>
            {error}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.button}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color="#c2410c" size="large" />
          <Text style={styles.body}>Securely opening your team workspace…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 20,
    backgroundColor: '#f6f7f4',
  },
  title: { color: '#203d2c', fontSize: 26, fontWeight: '700' },
  body: { color: '#58675e', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  button: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#c2410c',
    borderRadius: 8,
    padding: 14,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
