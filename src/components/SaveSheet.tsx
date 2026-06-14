import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { saveVideo } from '../data/library';
import { VideoItem } from '../types';
import { theme } from '../theme';

type SaveSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: (result: { is_new: boolean; video: VideoItem | null }) => void;
};

export function SaveSheet({ visible, onClose, onSaved }: SaveSheetProps) {
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setUrl('');
      setError(null);
      setSaving(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);

    try {
      const result = await saveVideo(trimmed);
      onClose();
      onSaved(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong, try again';
      const isValidationError = msg.startsWith('API error 400');
      if (isValidationError) {
        setError(msg.replace('API error 400: ', '').trim() || 'Unsupported URL or platform');
      } else {
        onClose();
        onSaved({ is_new: false, video: null });
      }
    } finally {
      setSaving(false);
    }
  };

  const canSave = url.trim().length > 0 && !saving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="link" size={18} color={theme.colors.text} />
            </View>
            <Text style={styles.title}>Save a video</Text>
            <Text style={styles.subtitle}>
              Paste a link from YouTube, Instagram, or TikTok
            </Text>
          </View>

          <TextInput
            ref={inputRef}
            style={[styles.input, error ? styles.inputError : null]}
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              if (error) setError(null);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!saving}
            returnKeyType="go"
            onSubmitEditing={handleSave}
          />

          {error && (
            <View style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={theme.colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <Feather name="download" size={16} color={theme.colors.white} />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  input: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 14,
    color: theme.colors.text,
    fontSize: 14,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
    flex: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.text,
  },
  saveButtonDisabled: {
    opacity: 0.35,
  },
  saveButtonText: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
