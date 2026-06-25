import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import {
  fetchVideo as apiFetchVideo,
  deleteVideo,
} from '../api/client';
import { VideoItem, HydratedVideo } from '../types';
import { theme } from '../theme';
import {
  EmbeddedVideoPlayer,
  isEmbeddablePlatform,
} from '../components/EmbeddedVideoPlayer';
import {
  formatRelativeTime,
  formatPlatform,
  formatContentType,
  formatDuration,
} from '../utils/format';

function SectionHeader({ icon, title }: { icon: keyof typeof Feather.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Feather name={icon} size={15} color={theme.colors.secondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function isPlaceholderText(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    /^stub (youtube|instagram|tiktok|twitter\/x) (title|description|post) for\b/.test(normalized) ||
    normalized === 'metadata is limited; this appears to be general video content with unclear subject matter.' ||
    normalized.startsWith('metadata suggests ')
  );
}

function cleanText(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || isPlaceholderText(trimmed)) {
    return null;
  }
  return trimmed;
}

export function DetailScreen({
  item,
  onClose,
  onDelete,
}: {
  item: VideoItem | null;
  onClose: () => void;
  onDelete?: (videoId: string) => void;
}) {
  const [hydrated, setHydrated] = useState<HydratedVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPlayerError(false);
    apiFetchVideo(item.id)
      .then((res) => {
        if (cancelled) return;
        setHydrated(res.video);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load details');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [item?.id]);

  const handleDelete = useCallback(() => {
    const id = hydrated?.id ?? item?.id;
    if (!id) return;
    Alert.alert(
      'Delete video',
      'Remove this video from your library?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVideo(id);
              onDelete?.(id);
              onClose();
            } catch {
              Alert.alert('Error', 'Failed to delete video');
            }
          },
        },
      ],
    );
  }, [hydrated, item, onClose, onDelete]);

  const handlePlayerError = useCallback(() => {
    setPlayerError(true);
  }, []);

  const openOriginal = useCallback(() => {
    const url = hydrated?.source_url ?? item?.sourceUrl;
    if (url) Linking.openURL(url);
  }, [hydrated, item]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80, 140], [1, 0.85, 0.55], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, [0, 140], [1, 0.88], Extrapolation.CLAMP) },
      { translateY: interpolate(scrollY.value, [0, 140], [0, -8], Extrapolation.CLAMP) },
    ],
  }));

  if (!item) {
    return (
      <View style={styles.center}>
        <Feather name="play-circle" size={30} color={theme.colors.muted} />
        <Text style={styles.emptyTitle}>Open a saved video</Text>
        <Text style={styles.emptyCopy}>
          Tap any thumbnail from Home or Search to open the detail view.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.playerCard, { minHeight: 300 }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Loading</Text>
              <Text style={styles.title}>{item.title}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.platform}</Text>
            </View>
          </View>
          <View style={[styles.skeletonPoster, { backgroundColor: item.thumbnailColor }]}>
            <ActivityIndicator size="large" color={theme.colors.white} />
          </View>
        </View>
      </ScrollView>
    );
  }

  if (error && !hydrated) {
    return (
      <View style={styles.center}>
        <Feather name="alert-circle" size={30} color={theme.colors.danger} />
        <Text style={styles.emptyTitle}>Failed to load</Text>
        <Text style={styles.emptyCopy}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => {
          setError(null);
          setLoading(true);
          apiFetchVideo(item.id)
            .then((res) => {
              setHydrated(res.video);
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
            .finally(() => setLoading(false));
        }}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const sourceUrl = hydrated?.source_url ?? item.sourceUrl;

  const title = cleanText(hydrated?.title) ?? item.title;
  const creator = cleanText(hydrated?.creator_handle) ?? cleanText(hydrated?.creator_name) ?? item.creator;
  const platformLabel = hydrated ? formatPlatform(hydrated.platform) : item.platform;
  const savedAgo = hydrated ? formatRelativeTime(hydrated.saved_at) : item.savedAgo;
  const summary = cleanText(hydrated?.summary) ?? item.summary;
  const typeLabel = hydrated ? formatContentType(hydrated.content_type) : item.type;
  const embedUrl = hydrated?.embed_url ?? item.embedUrl;
  const embedHtml = hydrated?.embed_html ?? item.embedHtml;
  const duration = hydrated?.duration_seconds ? formatDuration(hydrated.duration_seconds) : null;

  const isPlayer = isEmbeddablePlatform(hydrated?.platform ?? item.platform, sourceUrl) || !!embedUrl || !!embedHtml;
  const showYouTubeLink = platformLabel === 'YouTube';
  // Vertical-first platforms render 9:16; everything else is treated as 16:9.
  const isVertical =
    platformLabel === 'TikTok' ||
    platformLabel === 'Instagram' ||
    sourceUrl.includes('/shorts/');

  return (
    <Animated.ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      <Pressable style={styles.backButton} onPress={onClose}>
        <Feather name="chevron-left" size={20} color={theme.colors.text} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.playerCard}>
        <Animated.View style={[styles.headerWrap, heroAnimatedStyle]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{typeLabel}</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.creator}>{creator}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{platformLabel}</Text>
            </View>
          </View>

          <View style={styles.metaStrip}>
            {duration ? (
              <View style={styles.metaItem}>
                <Feather name="clock" size={12} color={theme.colors.muted} />
                <Text style={styles.metaText}>{duration}</Text>
              </View>
            ) : null}
            <View style={styles.metaItem}>
              <Feather name="bookmark" size={12} color={theme.colors.muted} />
              <Text style={styles.metaText}>Saved {savedAgo}</Text>
            </View>
          </View>
        </Animated.View>

        <View
          style={[
            styles.playerFrame,
            isVertical ? styles.playerFrameVertical : styles.playerFrameLandscape,
          ]}
        >
          {isPlayer && !playerError ? (
            <EmbeddedVideoPlayer
              platform={hydrated?.platform ?? item.platform}
              sourceUrl={sourceUrl}
              embedUrl={embedUrl}
              embedHtml={embedHtml}
              title={title}
              onError={handlePlayerError}
            />
          ) : isPlayer && playerError ? (
            <View style={[styles.fillPoster, { backgroundColor: theme.colors.cardSoft }]}>
              <Feather name="eye-off" size={32} color={theme.colors.tertiary} />
              <Text style={styles.playerErrorTitle}>Playback unavailable</Text>
              <Text style={styles.playerErrorCopy}>
                This provider is blocking the embedded player for this post.
              </Text>
              <Pressable style={styles.openInAppButton} onPress={openOriginal}>
                <Feather name="external-link" size={16} color={theme.colors.white} />
                <Text style={styles.openInAppButtonText}>Open original</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.fillPoster, { backgroundColor: item.thumbnailColor }]}>
              <Feather name="film" size={32} color={theme.colors.white} />
            </View>
          )}
        </View>

        {showYouTubeLink ? (
          <Pressable style={styles.youtubePill} onPress={openOriginal}>
            <Feather name="external-link" size={14} color={theme.colors.accent} />
            <Text style={styles.youtubePillText}>Open in YouTube</Text>
          </Pressable>
        ) : null}
      </View>

      {summary ? (
        <View style={styles.summaryCard}>
          <SectionHeader icon="align-left" title="Summary" />
          <Text style={styles.summaryBody}>{summary}</Text>
        </View>
      ) : null}

      <Pressable style={styles.linkButton} onPress={openOriginal}>
        <Feather name="external-link" size={16} color={theme.colors.card} />
        <Text style={styles.linkText}>Open original on {platformLabel}</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Feather name="trash-2" size={16} color={theme.colors.danger} />
        <Text style={styles.deleteText}>Delete video</Text>
      </Pressable>
    </Animated.ScrollView>
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
    fontSize: 24,
    fontWeight: '700',
  },
  emptyCopy: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
  playerCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
  },
  creator: {
    color: theme.colors.rust,
    fontSize: 13,
    marginTop: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  badgeText: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  playerFrame: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: theme.colors.cardSoft,
  },
  playerFrameLandscape: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  playerFrameVertical: {
    alignSelf: 'center',
    width: '72%',
    aspectRatio: 9 / 16,
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.cardSoft,
  },
  fillPoster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  playerErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 14,
  },
  playerErrorCopy: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 6,
    marginHorizontal: 32,
    lineHeight: 18,
  },
  openInAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.text,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    marginTop: 18,
  },
  openInAppButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  skeletonPoster: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 12,
  },
  youtubePillText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  summaryCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  summaryBody: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  headerWrap: {
    gap: 14,
  },
  metaStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    backgroundColor: theme.colors.text,
  },
  linkText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '700',
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
  retryButtonText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
});
