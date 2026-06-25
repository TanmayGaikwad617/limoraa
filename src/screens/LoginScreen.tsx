import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme';

type PendingAction = 'google' | 'email' | null;

export function LoginScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const loading = pendingAction !== null;

  const handleGoogleSignIn = async () => {
    setPendingAction('google');
    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert(
        'Google sign-in failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setPendingAction(null);
    }
  };

  const handleEmailAuth = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      Alert.alert('Missing details', 'Enter your email and password to continue.');
      return;
    }

    setPendingAction('email');
    try {
      if (isSignUp) {
        await signUp(cleanEmail, password);
        Alert.alert('Check your inbox', 'Confirm your email address, then sign in.');
      } else {
        await signIn(cleanEmail, password);
      }
    } catch (error) {
      Alert.alert(
        isSignUp ? 'Account creation failed' : 'Sign-in failed',
        error instanceof Error ? error.message : 'Authentication failed.',
      );
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.shell, isWide && styles.shellWide]}>
          {isWide ? (
            <View style={styles.brandPanel}>
              <View style={styles.brandMark}>
                <Feather name="bookmark" size={28} color={theme.colors.white} />
              </View>
              <View>
                <Text style={styles.brandName}>ContentCategorize</Text>
                <Text style={styles.brandCopy}>
                  Keep the clips worth revisiting in one private, searchable library.
                </Text>
              </View>
              <View style={styles.previewStack}>
                <View style={styles.previewCardPrimary}>
                  <Text style={styles.previewLabel}>Saved today</Text>
                  <Text style={styles.previewTitle}>12 creator clips</Text>
                  <View style={styles.previewTags}>
                    <Text style={styles.previewTagText}>Recipes</Text>
                    <Text style={styles.previewTagText}>Launch ideas</Text>
                  </View>
                </View>
                <View style={styles.previewCardSecondary}>
                  <Feather name="search" size={16} color="#f5efe5" />
                  <Text style={styles.previewSecondaryText}>Search summaries, tags, and creators</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.formPanel}>
            <View style={styles.mobileLogo}>
              <View style={styles.mobileMark}>
                <Feather name="bookmark" size={22} color={theme.colors.text} />
              </View>
              <Text style={styles.mobileLogoText}>ContentCategorize</Text>
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Sign in to your library</Text>
              <Text style={styles.subtitle}>
                Use Google for the fastest way back to your saved videos.
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && !loading ? styles.buttonPressed : null,
                loading ? styles.disabled : null,
              ]}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              {pendingAction === 'google' ? (
                <ActivityIndicator color={theme.colors.text} />
              ) : (
                <>
                  <View style={styles.googleGlyph}>
                    <Text style={styles.googleGlyphText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or use email</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.colors.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={theme.colors.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  textContentType={isSignUp ? 'newPassword' : 'password'}
                  editable={!loading}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.emailButton,
                  pressed && !loading ? styles.emailButtonPressed : null,
                  loading ? styles.disabled : null,
                ]}
                onPress={handleEmailAuth}
                disabled={loading}
              >
                {pendingAction === 'email' ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.emailButtonText}>
                    {isSignUp ? 'Create account' : 'Sign in with email'}
                  </Text>
                )}
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [styles.switchButton, pressed ? styles.switchPressed : null]}
              onPress={() => setIsSignUp((current) => !current)}
              disabled={loading}
            >
              <Text style={styles.switchText}>
                {isSignUp ? 'Already have an account? Sign in' : 'Need an account? Create one'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f0',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 18,
    justifyContent: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: '#d5ded8',
  },
  shellWide: {
    minHeight: 620,
    flexDirection: 'row',
  },
  brandPanel: {
    flex: 1,
    backgroundColor: '#111a1c',
    padding: 34,
    justifyContent: 'space-between',
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#c57b57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    color: '#f7fbf8',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
  },
  brandCopy: {
    color: '#bfd0c8',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    maxWidth: 380,
  },
  previewStack: {
    gap: 12,
  },
  previewCardPrimary: {
    borderRadius: 12,
    backgroundColor: '#dce9e1',
    padding: 18,
  },
  previewLabel: {
    color: '#49645a',
    fontSize: 12,
    fontWeight: '600',
  },
  previewTitle: {
    color: '#172321',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  previewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  previewTagText: {
    color: '#172321',
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#aac4b7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  previewCardSecondary: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#294044',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewSecondaryText: {
    color: '#f5efe5',
    fontSize: 13,
    flex: 1,
  },
  formPanel: {
    flex: 1,
    paddingHorizontal: 22,
    paddingVertical: 28,
    justifyContent: 'center',
  },
  mobileLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 36,
  },
  mobileMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#dce9e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileLogoText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.secondary,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  googleButton: {
    minHeight: 54,
    borderRadius: 12,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: '#d4ddd8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  buttonPressed: {
    backgroundColor: '#f5f8f6',
  },
  googleGlyph: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f3f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleGlyphText: {
    color: '#4285f4',
    fontSize: 15,
    fontWeight: '700',
  },
  googleButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#dce5e0',
  },
  dividerText: {
    color: theme.colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#d4ddd8',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: theme.colors.text,
    fontSize: 16,
    backgroundColor: theme.colors.white,
  },
  emailButton: {
    minHeight: 52,
    backgroundColor: theme.colors.text,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  emailButtonPressed: {
    backgroundColor: '#2a2722',
  },
  emailButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.62,
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  switchPressed: {
    backgroundColor: '#edf4f0',
  },
  switchText: {
    color: theme.colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
