import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export const colours = {
  background: '#f6f7f4',
  text: '#202b26',
  muted: '#58675e',
  primary: '#c2410c',
  forest: '#192d25',
  border: '#d4dcd2',
  card: '#ffffff',
  error: '#b42318',
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colours.background },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 16,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  heading: { color: colours.forest, fontSize: 28, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '600', color: colours.text },
  text: { color: colours.text, fontSize: 16, lineHeight: 24 },
  muted: { color: colours.muted, fontSize: 16, lineHeight: 24 },
  card: {
    padding: 16,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.card,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: {
    minHeight: 48,
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colours.muted,
    borderRadius: 8,
    color: colours.text,
    backgroundColor: colours.card,
  },
});
export function Screen({
  children,
  title,
  refresh,
  refreshing = false,
}: PropsWithChildren<{ title: string; refresh?: () => void; refreshing?: boolean }>) {
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          refreshControl={
            refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} /> : undefined
          }
        >
          <Text accessibilityRole="header" style={styles.heading}>
            {title}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Button({
  label,
  onPress,
  disabled,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: secondary ? '#eaf0e7' : colours.primary,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: secondary ? colours.forest : '#ffffff',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.text}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colours.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}
export function Choices<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.text}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option.value, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              minHeight: 48,
              justifyContent: 'center',
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: value === option.value ? colours.primary : colours.border,
              backgroundColor: value === option.value ? '#fff1e8' : colours.card,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={styles.text}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function ErrorText({ error }: { error: string | null | undefined }) {
  return error ? (
    <Text accessibilityRole="alert" style={{ color: colours.error, fontSize: 16, lineHeight: 24 }}>
      {error}
    </Text>
  ) : null;
}
export function Loading() {
  return <ActivityIndicator accessibilityLabel="Loading" color={colours.primary} size="large" />;
}
export function human(value: string) {
  return value.replaceAll('_', ' ');
}
