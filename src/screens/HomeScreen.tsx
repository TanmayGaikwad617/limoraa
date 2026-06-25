import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { fetchVideo, fetchVideos } from '../data/library';
import { deleteVideo } from '../api/client';
import { VideoItem } from '../types';
import { CardRect } from '../components/VideoCard';
import { MasonryColumns } from '../components/MasonryColumns';
import { SaveSheet } from '../components/SaveSheet';
import { theme } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PAGE_SIZE = 50;
const skeletonCards = [0, 1, 2, 3, 4, 5];

let cachedVideos: VideoItem[] | null = null;

function SkeletonBlock({ style }: { style?: object }) {
  return <View style={[styles.skeletonBlock, style]} />;
}

function SkeletonVideoCard({ tall = false }: { tall?: boolean }) {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonBlock style={[styles.skeletonThumbnail, { minHeight: tall ? 220 : 168 }]} />
      <View style={styles.skeletonTextBlock}>
        <SkeletonBlock style={styles.skeletonTitleLine} />
        <SkeletonBlock style={styles.skeletonMetaLine} />
        <SkeletonBlock style={styles.skeletonCaptionLine} />
        <View style={styles.skeletonFooter}>
          <SkeletonBlock style={styles.skeletonFooterLine} />
          <SkeletonBlock style={styles.skeletonFooterLineShort} />
        </View>
      </View>
    </View>
  );
}

function LoadingMasonrySkeleton() {
  const left = skeletonCards.filter((_, index) => index % 2 === 0);
  const right = skeletonCards.filter((_, index) => index % 2 === 1);

  return (
    <View style={styles.gridSkeleton}>
      <View style={styles.skeletonColumn}>
        {left.map((item, index) => (
          <SkeletonVideoCard key={item} tall={index % 2 === 0} />
        ))}
      </View>
      <View style={styles.skeletonColumn}>
        {right.map((item, index) => (
          <SkeletonVideoCard key={item} tall={index % 2 !== 0} />
        ))}
      </View>
    </View>
  );
}

export function HomeScreen({
  onOpen,
  fabHidden,
}: {
  onOpen: (item: VideoItem, sourceRect?: CardRect) => void;
  fabHidden?: SharedValue<number>;
}) {
  const [videos, setVideos] = useState<VideoItem[]>(() => cachedVideos ?? []);
  const [loading, setLoading] = useState(() => cachedVideos === null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(() => cachedVideos?.length ?? 0);
  const [hasMore, setHasMore] = useState(() => !cachedVideos || cachedVideos.length >= PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videosRef = useRef(videos);
  videosRef.current = videos;

  const updateVideos = useCallback((next: VideoItem[] | ((current: VideoItem[]) => VideoItem[])) => {
    setVideos((current) => {
      const resolved = typeof next === 'function'
        ? (next as (current: VideoItem[]) => VideoItem[])(current)
        : next;
      cachedVideos = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const doPoll = useCallback(async () => {
    const current = videosRef.current;
    const processingStatuses = ['queued', 'fetching_metadata', 'analyzing'];
    const processing = current.filter((v) => processingStatuses.includes(v.status));
    if (processing.length === 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const results = await Promise.allSettled(processing.map((v) => fetchVideo(v.id)));
    const updates: VideoItem[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) updates.push(r.value);
    }
    if (updates.length === 0) return;

    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        420,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );

    updateVideos((prev) => {
      let changed = false;
      const next = prev.map((v) => {
        const u = updates.find((x) => x.id === v.id);
        if (u && (u.status !== v.status || u.title !== v.title)) {
          changed = true;
          return u;
        }
        return v;
      });
      return changed ? next : prev;
    });
  }, [updateVideos]);

  useEffect(() => {
    const processingStatuses = ['queued', 'fetching_metadata', 'analyzing'];
    const needsPoll = videos.some((v) => processingStatuses.includes(v.status));

    if (needsPoll && !pollRef.current) {
      pollRef.current = setInterval(doPoll, 5000);
    } else if (!needsPoll && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [videos, doPoll]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const handleSaved = useCallback(
    (result: { is_new: boolean; video: VideoItem | null }) => {
      if (result.is_new && result.video) {
        updateVideos((prev) => [result.video!, ...prev]);
        setToast({ message: 'Saved - processing', type: 'success' });
      } else if (!result.is_new && result.video) {
        setToast({ message: 'Already in your library', type: 'info' });
        onOpen(result.video);
      } else {
        setToast({ message: 'Something went wrong, try again', type: 'info' });
      }
    },
    [onOpen, updateVideos],
  );

  const handleRetry = useCallback(() => {
    Alert.alert(
      'Retry not available',
      'The backend does not yet support retrying failed videos. This is a known gap that will be addressed in a future update.',
    );
  }, []);

  const handleSwipeDelete = useCallback(async (item: VideoItem) => {
    updateVideos((prev) => prev.filter((v) => v.id !== item.id));
    setToast({ message: 'Deleted', type: 'success' });
    try {
      await deleteVideo(item.id);
    } catch {
      updateVideos((prev) => [item, ...prev]);
      setToast({ message: 'Failed to delete, restored', type: 'info' });
    }
  }, [updateVideos]);

  const handleSwipeMove = useCallback((_item: VideoItem) => {
    setToast({ message: 'Open the video to move it to a collection', type: 'info' });
  }, []);

  const loadVideos = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    try {
      const items = await fetchVideos({ limit: PAGE_SIZE, offset: currentOffset });
      if (reset) {
        updateVideos(items);
        setOffset(PAGE_SIZE);
      } else {
        updateVideos((prev) => [...prev, ...items]);
        setOffset((prev) => prev + PAGE_SIZE);
      }
      setHasMore(items.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    }
  }, [offset, updateVideos]);

  useEffect(() => {
    let cancelled = false;
    if (!cachedVideos) {
      setLoading(true);
    }
    fetchVideos({ limit: PAGE_SIZE, offset: 0 })
      .then((items) => {
        if (cancelled) return;
        updateVideos(items);
        setOffset(PAGE_SIZE);
        setHasMore(items.length === PAGE_SIZE);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [updateVideos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const items = await fetchVideos({ limit: PAGE_SIZE, offset: 0 });
      updateVideos(items);
      setOffset(PAGE_SIZE);
      setHasMore(items.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    } finally {
      setRefreshing(false);
    }
  }, [updateVideos]);

  const onScrollEnd = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    loadVideos(false).finally(() => setLoadingMore(false));
  }, [hasMore, loadingMore, loadVideos]);

  const lastY = useSharedValue(0);
  const SCROLL_DELTA = 12;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const delta = y - lastY.value;
      if (!fabHidden) return;
      if (y < 24) {
        fabHidden.value = withTiming(0, { duration: 180 });
      } else if (delta > SCROLL_DELTA) {
        fabHidden.value = withTiming(1, { duration: 220 });
      } else if (delta < -SCROLL_DELTA) {
        fabHidden.value = withTiming(0, { duration: 220 });
      }
      lastY.value = y;
    },
    onMomentumEnd: (event) => {
      const { layoutMeasurement, contentOffset, contentSize } = event;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) {
        runOnJS(onScrollEnd)();
      }
    },
  }, [onScrollEnd, fabHidden]);

  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {toast && (
        <View style={[styles.toastBanner, toast.type === 'success' ? styles.toastSuccess : styles.toastInfo]}>
          <Feather
            name={toast.type === 'success' ? 'check-circle' : 'info'}
            size={14}
            color={toast.type === 'success' ? '#059669' : theme.colors.text}
          />
          <Text style={[styles.toastText, toast.type === 'success' ? styles.toastTextSuccess : null]}>
            {toast.message}
          </Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>Library</Text>
          <Text style={styles.sectionTitle}>Recent saves</Text>
        </View>
        <Text style={styles.sectionAction}>Thumbnail first</Text>
      </View>

      {loading && videos.length === 0 ? (
        <LoadingMasonrySkeleton />
      ) : videos.length === 0 && !error ? (
        <View style={styles.emptyState}>
          <Feather name="book-open" size={32} color={theme.colors.muted} />
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.emptyCopy}>
            Save your first video to get started. Tap + to add a URL.
          </Text>
        </View>
      ) : (
        <MasonryColumns
          items={videos}
          onOpen={onOpen}
          onRetry={handleRetry}
          onDelete={handleSwipeDelete}
          onMoveToCollection={handleSwipeMove}
        />
      )}

      {loadingMore && (
        <ActivityIndicator size="small" color={theme.colors.text} style={{ marginTop: 16 }} />
      )}

      <SaveSheet
        visible={showSaveSheet}
        onClose={() => setShowSaveSheet(false)}
        onSaved={handleSaved}
      />
    </Animated.ScrollView>
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
  gridSkeleton: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonColumn: {
    flex: 1,
    gap: 12,
  },
  skeletonCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  skeletonBlock: {
    backgroundColor: theme.colors.skeleton,
  },
  skeletonThumbnail: {
    width: '100%',
  },
  skeletonTextBlock: {
    padding: 12,
    gap: 8,
  },
  skeletonTitleLine: {
    height: 18,
    width: '86%',
    borderRadius: theme.radius.sm,
  },
  skeletonMetaLine: {
    height: 12,
    width: '52%',
    borderRadius: theme.radius.sm,
  },
  skeletonCaptionLine: {
    height: 34,
    width: '100%',
    borderRadius: theme.radius.sm,
  },
  skeletonFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  skeletonFooterLine: {
    height: 10,
    width: 48,
    borderRadius: theme.radius.sm,
  },
  skeletonFooterLineShort: {
    height: 10,
    width: 36,
    borderRadius: theme.radius.sm,
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
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
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastSuccess: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  toastInfo: {
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  toastText: {
    fontSize: 13,
    flex: 1,
  },
  toastTextSuccess: {
    color: '#059669',
    fontWeight: '600',
  },
});
