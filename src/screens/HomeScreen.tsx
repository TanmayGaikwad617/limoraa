import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { fetchVideos } from '../data/library';
import { VideoItem } from '../types';
import { MasonryColumns } from '../components/MasonryColumns';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

const PAGE_SIZE = 50;
const quickFilters = ['All', 'TikTok', 'Instagram', 'YouTube', 'Recipes', 'Workouts', 'DIY', 'Education'];

export function HomeScreen({ onOpen }: { onOpen: (item: VideoItem) => void }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    try {
      const items = await fetchVideos({ limit: PAGE_SIZE, offset: currentOffset });
      if (reset) {
        setVideos(items);
        setOffset(PAGE_SIZE);
      } else {
        setVideos((prev) => [...prev, ...items]);
        setOffset((prev) => prev + PAGE_SIZE);
      }
      setHasMore(items.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    }
  }, [offset]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchVideos({ limit: PAGE_SIZE, offset: 0 })
      .then((items) => {
        if (cancelled) return;
        setVideos(items);
        setOffset(PAGE_SIZE);
        setHasMore(items.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const items = await fetchVideos({ limit: PAGE_SIZE, offset: 0 });
      setVideos(items);
      setOffset(PAGE_SIZE);
      setHasMore(items.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onScrollEnd = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    loadVideos(false).finally(() => setLoadingMore(false));
  }, [hasMore, loadingMore, loadVideos]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onMomentumScrollEnd={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
          onScrollEnd();
        }
      }}
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrow}>Private library</Text>
            <Text style={styles.title}>Good morning, Christ</Text>
            <Text style={styles.subtitle}>
              Save what matters. Browse it like a board, not like a feed.
            </Text>
          </View>
          <Pressable style={styles.addButton}>
            <Feather name="plus" size={18} color={theme.colors.card} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>{videos.length} Saved</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>0 Collections</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchCard}>
        <Feather name="search" size={18} color={theme.colors.muted} />
        <Text style={styles.searchText}>Search videos, tags, creators, or summaries</Text>
      </View>

      <View style={styles.filterRow}>
        {quickFilters.map((item, index) => (
          <Pill key={item} label={item} active={index === 0} />
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>Processing</Text>
          <Text style={styles.sectionTitle}>0 items being analyzed</Text>
        </View>
        <Text style={styles.sectionAction}>Tap for queue</Text>
      </View>

      <View style={styles.processingCard}>
        {['Queued', 'Fetching metadata', 'Analyzing'].map((stage) => (
          <View key={stage} style={styles.processingRow}>
            <View style={styles.processingDot} />
            <Text style={styles.processingLabel}>{stage}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>Library</Text>
          <Text style={styles.sectionTitle}>Recent saves</Text>
        </View>
        <Text style={styles.sectionAction}>Thumbnail first</Text>
      </View>

      {videos.length === 0 && !error ? (
        <View style={styles.emptyState}>
          <Feather name="book-open" size={32} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.emptyCopy}>
            Save your first video to get started. Tap + to add a URL.
          </Text>
        </View>
      ) : (
        <MasonryColumns items={videos} onOpen={onOpen} />
      )}

      {loadingMore && (
        <ActivityIndicator size="small" color={theme.colors.text} style={{ marginTop: 16 }} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: 24,
    gap: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.md,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
  },
  errorBannerText: {
    color: theme.colors.danger,
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  retryText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  heroCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 280,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statLabel: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  searchText: {
    color: theme.colors.muted,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  sectionEyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 6,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  sectionAction: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  processingCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 12,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  processingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accent,
  },
  processingLabel: {
    color: theme.colors.muted,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyCopy: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 260,
  },
});
