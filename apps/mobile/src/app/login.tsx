import { Redirect, useLocalSearchParams } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AUTH_REDIRECT_URL,
  consumeReturnPath,
  rememberReturnPath,
  safeReturnPath,
} from '../lib/auth-callback';
import { supabase } from '../lib/supabase';
import { useAuth } from '../providers/auth';

export default function LoginScreen() {
  const { session, profile, error: authError } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destination] = useState(() => (returnTo ? safeReturnPath(returnTo) : consumeReturnPath()));
  useEffect(() => {
    rememberReturnPath(destination);
  }, [destination]);

  async function submit(mode: 'password' | 'magic') {
    if (pending) return;
    setError(null);
    setMessage(null);
    const canonicalEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonicalEmail) || (mode === 'password' && !password)) {
      setError(
        mode === 'password' ? 'Enter your email and password.' : 'Enter a valid email address.',
      );
      return;
    }
    setPending(true);
    try {
      const result =
        mode === 'password'
          ? await supabase.auth.signInWithPassword({ email: canonicalEmail, password })
          : await supabase.auth.signInWithOtp({
              email: canonicalEmail,
              options: { shouldCreateUser: false, emailRedirectTo: AUTH_REDIRECT_URL },
            });
      if (result.error) throw result.error;
      setPassword('');
      if (mode === 'magic')
        setMessage(
          'If this email has an account, a sign-in link is on its way. Open it on this device.',
        );
    } catch {
      setError(
        mode === 'password'
          ? 'Unable to sign in. Check your email, password and connection, then retry.'
          : 'Unable to send a sign-in link. Check your connection and retry.',
      );
    } finally {
      setPending(false);
    }
  }

  if (session && profile?.is_active) return <Redirect href={destination as Href} />;
  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.eyebrow}>FIELDWORK, CONNECTED</Text>
            <Text style={styles.title}>SnagFlow</Text>
            <Text style={styles.subtitle}>A clearer handover starts on site.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.heading}>Sign in to your team</Text>
            <Text style={styles.body}>Use the account provided by your administrator.</Text>
            <Text nativeID="email-label" style={styles.label}>
              Email
            </Text>
            <TextInput
              accessibilityLabel="Email"
              accessibilityLabelledBy="email-label"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              editable={!pending}
              returnKeyType="next"
            />
            <Text nativeID="password-label" style={styles.label}>
              Password
            </Text>
            <TextInput
              accessibilityLabel="Password"
              accessibilityLabelledBy="password-label"
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              value={password}
              onChangeText={setPassword}
              editable={!pending}
              onSubmitEditing={() => {
                void submit('password');
              }}
              returnKeyType="go"
            />
            {(error || authError) && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error || authError}
              </Text>
            )}
            {message && (
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {message}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending, busy: pending }}
              disabled={pending}
              onPress={() => {
                void submit('password');
              }}
              style={[styles.primary, pending && styles.disabled]}
            >
              <Text style={styles.primaryText}>{pending ? 'Please wait…' : 'Sign in'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => {
                void submit('magic');
              }}
              style={[styles.secondary, pending && styles.disabled]}
            >
              <Text style={styles.secondaryText}>Email me a sign-in link</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: '#f6f7f4' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 28,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  brand: { gap: 8 },
  eyebrow: { color: '#c2410c', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#203d2c', fontSize: 42, fontWeight: '800' },
  subtitle: { color: '#58675e', fontSize: 17, lineHeight: 25 },
  card: {
    backgroundColor: '#fff',
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dce2d9',
    gap: 12,
  },
  heading: { color: '#202b26', fontSize: 23, fontWeight: '700' },
  body: { color: '#58675e', fontSize: 16, lineHeight: 24 },
  label: { color: '#202b26', fontSize: 15, fontWeight: '600', marginTop: 6 },
  input: {
    color: '#202b26',
    borderWidth: 1,
    borderColor: '#859289',
    borderRadius: 8,
    padding: 12,
    minHeight: 50,
    fontSize: 17,
    backgroundColor: '#fff',
  },
  primary: {
    minHeight: 50,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#c2410c',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  secondary: {
    minHeight: 50,
    padding: 14,
    borderWidth: 1,
    borderColor: '#859289',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: '#203d2c', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.65 },
  error: { color: '#a22c24', fontSize: 16, lineHeight: 24 },
});
