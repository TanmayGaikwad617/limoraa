import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { deleteCollection, fetchCollection } from '../api/client';
import { toVideoItem } from '../data/library';
import { CollectionDetail, VideoItem } from '../types';
import { MasonryColumns } from '../components/MasonryColumns';
import { theme } from '../theme';

type SortKey = 'recent' | 'oldest' | 'creator' | 'platform';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'creator', label: 'Creator' },
  { key: 'platform', label: 'Platform' },
];

function sortVideos(items: VideoItem[], sort: SortKey): VideoItem[] {
  const sorted = [...items];
  switch (sort) {
    case 'recent':
      return sorted;
    case 'oldest':
      return sorted.reverse();
    case 'creator':
      return sorted.sort((a, b) => a.creator.localeCompare(b.creator));
    case 'platform':
      return sorted.sort((a, b) => a.platform.localeCompare(b.platform));
  }
}

export function CollectionDetailScreen({
  collectionId,
  onClose,
  onOpen,
  onRetry,
}: {
  collectionId: string;
  onClose: () => void;
  onOpen: (item: VideoItem) => void;
  onRetry?: (item: VideoItem) => void;
}) {
  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('recent');
  const [showSortPicker, setShowSortPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchCollection(collectionId);
      setCollection(res.collection);
      setVideos(res.collection.videos.map(toVideoItem));
    } catch {
      Alert.alert('Error', 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const sortedVideos = useMemo(() => sortVideos(videos, sort), [videos, sort]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete collection',
      `Remove "${collection?.name ?? 'this collection'}"? Videos in it will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCollection(collectionId);
              onClose();
            } catch {
              Alert.alert('Error', 'Failed to delete collection');
            }
          },
        },
      ],
    );
  }, [collectionId, collection, onClose]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={30} color={theme.colors.danger} />
        <Text style={styles.emptyTitle}>Collection not found</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const iconName = (collection.icon ?? 'folder') as keyof typeof Feather.glyphMap;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Pressable style={styles.backButton} onPress={onClose}>
        <Feather name="chevron-left" size={20} color={theme.colors.text} />
        <Text style={styles.backText}>Collections</Text>
      </Pressable>

      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.iconCircle}>
            <Feather name={iconName in Feather.glyphMap ? iconName : 'folder'} size={24} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{collection.name}</Text>
            <Text style={styles.meta}>
              {collection.item_count} {collection.item_count === 1 ? 'item' : 'items'}
              {'  ·  '}
              {collection.type === 'smart' ? 'Smart' : 'Manual'}
            </Text>
          </View>
        </View>
        {collection.description ? (
          <Text style={styles.description}>{collection.description}</Text>
        ) : null}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort</Text>
        <Pressable style={styles.sortPicker} onPress={() => setShowSortPicker(!showSortPicker)}>
          <Text style={styles.sortPickerText}>{SORT_OPTIONS.find((o) => o.key === sort)?.label}</Text>
          <Feather name={showSortPicker ? 'chevron-up' : 'chevron-down'} size={14} color={theme.colors.text} />
        </Pressable>
      </View>

      {showSortPicker && (
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.sortOption, sort === option.key && styles.sortOptionActive]}
              onPress={() => { setSort(option.key); setShowSortPicker(false); }}
            >
              <Text style={[styles.sortOptionText, sort === option.key && styles.sortOptionTextActive]}>
                {option.label}
              </Text>
              {sort === option.key && <Feather name="check" size={14} color={theme.colors.accent} />}
            </Pressable>
          ))}
        </View>
      )}

      {sortedVideos.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="film" size={32} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>No videos yet</Text>
          <Text style={styles.emptyCopy}>Save videos to this collection from the detail screen.</Text>
        </View>
      ) : (
        <MasonryColumns items={sortedVideos} onOpen={onOpen} onRetry={onRetry} />
      )}

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Feather name="trash-2" size={16} color={theme.colors.danger} />
        <Text style={styles.deleteText}>Delete collection</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  headerCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    color: theme.colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  description: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  sortPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sortPickerText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  sortDropdown: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sortOptionActive: {
    backgroundColor: theme.colors.cardSoft,
  },
  sortOptionText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  sortOptionTextActive: {
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  emptyCopy: {
    color: theme.colors.muted,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 240,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.text,
  },
  retryText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
});
