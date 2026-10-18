import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { APP_NAME, Logo } from '../components/Logo';
import { isFirebaseConfigured } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow } from '../theme';

interface FieldErrors {
  username?: string;
  password?: string;
}

function validate(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const u = username.trim();
  if (!u) errors.username = 'Enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) errors.username = 'Enter a valid email address.';
  else if (u.length > 190) errors.username = 'Email is too long.';
  if (!password) errors.password = 'Enter your password.';
  else if (password.length > 256) errors.password = 'Password is too long.';
  return errors;
}

export function LoginScreen() {
  const { login, notice } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [appear]);

  const onSubmit = async () => {
    if (loading) return;
    const fieldErrors = validate(username, password);
    setErrors(fieldErrors);
    setFormError(null);
    if (fieldErrors.username || fieldErrors.password) return;

    if (!isFirebaseConfigured()) {
      setFormError('Firebase is not configured. Check src/config/firebase.ts');
      return;
    }

    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (error) {
      setPassword('');
      setFormError(error instanceof Error ? error.message : 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  const banner = formError ?? notice;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={{
              opacity: appear,
              transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}
          >
            <View style={styles.brand}>
              <Logo size={80} />
              <Text style={styles.appName}>{APP_NAME}</Text>
              <Text style={styles.tagline}>ESP32 4WD · Firebase login</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Sign in</Text>

              {banner ? (
                <View style={styles.errorBanner} accessibilityLiveRegion="polite">
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.errorBannerText}>{banner}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputRow, errors.username && styles.inputRowError]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t);
                    if (errors.username) setErrors((e) => ({ ...e, username: undefined }));
                  }}
                  placeholder="ayenulhkhan3@gmail.com"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  keyboardType="email-address"
                  returnKeyType="next"
                  editable={!loading}
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabel="Email"
                />
              </View>
              {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : null}

              <Text style={[styles.label, styles.labelSpacing]}>Password</Text>
              <View style={[styles.inputRow, errors.password && styles.inputRowError]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  ref={passwordRef}
                  style={styles.input}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
                  }}
                  placeholder="Your password"
                  placeholderTextColor={colors.textFaint}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  editable={!loading}
                  onSubmitEditing={onSubmit}
                  accessibilityLabel="Password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

              <Pressable
                onPress={onSubmit}
                disabled={loading}
                style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Login"
                accessibilityState={{ busy: loading, disabled: loading }}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 28 },
  appName: { marginTop: 16, fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: 0.3 },
  tagline: { marginTop: 4, fontSize: 14, color: colors.textMuted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8 },
  labelSpacing: { marginTop: 16 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 52,
  },
  inputRowError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
  fieldError: { color: colors.danger, fontSize: 12.5, marginTop: 6 },
  errorBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: { flex: 1, color: colors.dangerDark, fontSize: 13.5, lineHeight: 19 },
  button: {
    marginTop: 24,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
