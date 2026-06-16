import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { createCollection, fetchCollections } from '../api/client';
import { CollectionItem } from '../types';
import { CollectionCard } from '../components/CollectionCard';
import { theme } from '../theme';

const ICON_OPTIONS = [
  'bookmark', 'folder', 'tag', 'heart', 'star', 'flag',
  'grid', 'layers', 'archive', 'briefcase', 'compass', 'camera',
  'video', 'music', 'image', 'file-text', 'list', 'map-pin',
  'book-open', 'coffee', 'gift', 'globe', 'monitor', 'smartphone',
  'feather', 'sun', 'moon', 'cloud', 'zap', 'anchor',
];

export function CollectionsScreen({
  onOpenCollection,
}: {
  onOpenCollection: (id: string) => void;
}) {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('folder');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchCollections();
      setCollections(res.items);
    } catch {
      Alert.alert('Error', 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await createCollection({ name, icon: newIcon, type: 'manual' });
      setNewName('');
      setNewIcon('folder');
      setShowCreate(false);
      await load();
    } catch {
      Alert.alert('Error', 'Failed to create collection');
    } finally {
      setCreating(false);
    }
  }, [newName, newIcon, load]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Collections</Text>
        <Text style={styles.title}>Boards for what you actually want to keep</Text>
      </View>

      <Pressable style={styles.createButton} onPress={() => setShowCreate(true)}>
        <Feather name="plus" size={16} color={theme.colors.accent} />
        <Text style={styles.createButtonText}>Create Collection</Text>
      </Pressable>

      <View style={styles.grid}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.text} style={{ width: '100%', paddingVertical: 40 }} />
        ) : collections.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="folder" size={32} color={theme.colors.muted} />
            <Text style={styles.emptyTitle}>No collections yet</Text>
            <Text style={styles.emptyCopy}>Create your first collection to organize saved videos.</Text>
          </View>
        ) : (
          collections.map((item) => (
            <CollectionCard key={item.id} item={item} onPress={() => onOpenCollection(item.id)} />
          ))
        )}
      </View>

      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Collection</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Feather name="x" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Collection name"
              placeholderTextColor={theme.colors.tertiary}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((name) => {
                const selected = name === newIcon;
                return (
                  <Pressable
                    key={name}
                    style={[styles.iconOption, selected && styles.iconOptionSelected]}
                    onPress={() => setNewIcon(name)}
                  >
                    <Feather
                      name={name as keyof typeof Feather.glyphMap}
                      size={18}
                      color={selected ? theme.colors.card : theme.colors.text}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[styles.modalConfirm, !newName.trim() && styles.modalConfirmDisabled]}
              onPress={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? (
                <ActivityIndicator size={16} color={theme.colors.card} />
              ) : (
                <Text style={styles.modalConfirmText}>Create</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  headerCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
  },
  createButtonText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  emptyState: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyCopy: {
    color: theme.colors.muted,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: 18,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  fieldLabel: {
    color: theme.colors.secondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  iconOption: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOptionSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  modalConfirm: {
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  modalConfirmDisabled: {
    opacity: 0.4,
  },
  modalConfirmText: {
    color: theme.colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
});
