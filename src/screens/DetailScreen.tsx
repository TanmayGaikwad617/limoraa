import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

import {
  fetchVideo as apiFetchVideo,
  fetchCollections,
  addTags,
  deleteTags,
  addVideoToCollection,
  removeVideoFromCollection,
  deleteVideo,
} from '../api/client';
import { VideoItem, HydratedVideo, CollectionItem } from '../types';
import { theme } from '../theme';
import {
  formatRelativeTime,
  formatPlatform,
  formatContentType,
  formatDuration,
} from '../utils/format';

// Vertical fields that duplicate other sections or are internal-only noise.
const SKIP_VERTICAL_FIELDS = new Set(['summary', 'confidence']);

function CollapsibleText({ text, lines = 6 }: { text: string; lines?: number }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 220;
  return (
    <View>
      <Text style={styles.body} numberOfLines={expanded || !isLong ? undefined : lines}>
        {text}
      </Text>
      {isLong ? (
        <Pressable hitSlop={8} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.showMore}>{expanded ? 'Show less' : 'Show more'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HashtagList({ tags }: { tags: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const overflow = tags.length - LIMIT;
  const shown = expanded ? tags : tags.slice(0, LIMIT);
  return (
    <View style={styles.tagRow}>
      {shown.map((h) => (
        <View key={h} style={styles.aiTag}>
          <Text style={styles.aiTagText}>{h}</Text>
        </View>
      ))}
      {overflow > 0 ? (
        <Pressable style={styles.moreTag} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.moreTagText}>{expanded ? 'Show less' : `+${overflow} more`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Feather.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Feather name={icon} size={15} color={theme.colors.secondary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const VERTICAL_FIELD_LABELS: Record<string, Record<string, string>> = {
  recipe: {
    ingredients: 'Ingredients',
    cuisine: 'Cuisine',
    meal_type: 'Meal type',
    diet_type: 'Diet',
  },
  workout: {
    muscle_group: 'Muscle group',
    workout_type: 'Workout type',
    equipment: 'Equipment',
    goal: 'Goal',
  },
  tutorial_diy: {
    tools: 'Tools',
    materials: 'Materials',
    skill_level: 'Skill level',
  },
  beauty_fashion: {
    product_type: 'Product type',
    style: 'Style',
    aesthetic: 'Aesthetic',
  },
  education: {
    topic_area: 'Topic area',
    difficulty: 'Difficulty',
    learning_goal: 'Learning goal',
  },
  entertainment: {
    style: 'Style',
    mood: 'Mood',
    hook: 'Hook',
  },
};

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
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

  const [userTags, setUserTags] = useState<string[]>([]);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [videoCollectionIds, setVideoCollectionIds] = useState<string[]>([]);

  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const tagInputRef = useRef<TextInput>(null);

  const [allCollections, setAllCollections] = useState<CollectionItem[]>([]);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [pendingCollectionIds, setPendingCollectionIds] = useState<Set<string>>(new Set());
  const [collectionSubmitting, setCollectionSubmitting] = useState(false);
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
        setUserTags(res.video.tags.filter((t) => t.source === 'user').map((t) => t.tag));
        setAiTags(res.video.tags.filter((t) => t.source === 'ai').map((t) => t.tag));
        setVideoCollectionIds(res.video.collections.map((c) => c.id));
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

  const handleAddTag = useCallback(async () => {
    const tag = newTag.trim();
    if (!tag || !hydrated) return;
    setTagSubmitting(true);
    try {
      const res = await addTags(hydrated.id, [tag]);
      setUserTags((prev) => [...prev, ...res.tags]);
      setNewTag('');
      setShowTagInput(false);
    } catch {
      Alert.alert('Error', 'Failed to add tag');
    } finally {
      setTagSubmitting(false);
    }
  }, [newTag, hydrated]);

  const handleDeleteTag = useCallback(async (tag: string) => {
    if (!hydrated) return;
    try {
      await deleteTags(hydrated.id, [tag]);
      setUserTags((prev) => prev.filter((t) => t !== tag));
    } catch {
      Alert.alert('Error', 'Failed to remove tag');
    }
  }, [hydrated]);

  const openCollectionPicker = useCallback(async () => {
    try {
      const res = await fetchCollections();
      setAllCollections(res.items);
      setPendingCollectionIds(new Set(videoCollectionIds));
      setShowCollectionPicker(true);
    } catch {
      Alert.alert('Error', 'Failed to load collections');
    }
  }, [videoCollectionIds]);

  const handleToggleCollection = useCallback((id: string) => {
    setPendingCollectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSaveCollections = useCallback(async () => {
    if (!hydrated) return;
    setCollectionSubmitting(true);
    const current = new Set(videoCollectionIds);
    const toAdd = [...pendingCollectionIds].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !pendingCollectionIds.has(id));
    try {
      await Promise.all([
        ...toAdd.map((id) => addVideoToCollection(id, hydrated.id)),
        ...toRemove.map((id) => removeVideoFromCollection(id, hydrated.id)),
      ]);
      setVideoCollectionIds([...pendingCollectionIds]);
      setShowCollectionPicker(false);
    } catch {
      Alert.alert('Error', 'Failed to update collections');
    } finally {
      setCollectionSubmitting(false);
    }
  }, [hydrated, videoCollectionIds, pendingCollectionIds]);

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

  const handleWebViewError = useCallback(({ nativeEvent }: { nativeEvent: { code?: number } }) => {
    if (nativeEvent.code === 153) {
      setPlayerError(true);
    }
  }, []);

  const openInYouTube = useCallback(() => {
    const url = hydrated?.source_url ?? item?.sourceUrl;
    if (url) Linking.openURL(url);
  }, [hydrated, item]);

  useEffect(() => {
    if (showTagInput) tagInputRef.current?.focus();
  }, [showTagInput]);

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
              setUserTags(res.video.tags.filter((t) => t.source === 'user').map((t) => t.tag));
              setAiTags(res.video.tags.filter((t) => t.source === 'ai').map((t) => t.tag));
              setVideoCollectionIds(res.video.collections.map((c) => c.id));
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

  const v = hydrated ?? item;
  const creator = hydrated?.creator_handle ?? hydrated?.creator_name ?? item.creator;
  const platformLabel = hydrated ? formatPlatform(hydrated.platform) : item.platform;
  const savedAgo = hydrated ? formatRelativeTime(hydrated.saved_at) : item.savedAgo;
  const summary = hydrated?.summary ?? item.summary;
  const typeLabel = hydrated ? formatContentType(hydrated.content_type) : item.type;
  const embedUrl = hydrated?.embed_url ?? item.embedUrl;
  const duration = hydrated?.duration_seconds ? formatDuration(hydrated.duration_seconds) : null;

  const isPlayer =
    platformLabel === 'YouTube' || platformLabel === 'TikTok' || !!embedUrl;
  // Vertical-first platforms render 9:16; everything else is treated as 16:9.
  const isVertical = platformLabel === 'TikTok' || platformLabel === 'Instagram';

  const analysis = hydrated?.analysis as Record<string, unknown> | null;
  const topic = analysis?.topic as string | undefined;
  const formatVal = analysis?.format as string | undefined;
  const intent = analysis?.intent as string | undefined;
  const audience = analysis?.audience as string | undefined;
  const qualityScore = analysis?.quality_score as number | undefined;
  const verticalType = analysis?.vertical_type as string | undefined;
  const verticalFields = analysis?.vertical_fields_json as Record<string, unknown> | undefined;
  const analysisTags = asArray(analysis?.tags_json);

  const caption = hydrated?.caption;
  const description = hydrated?.description;
  const hashtags = hydrated?.hashtags?.length ? hydrated.hashtags : null;

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
              <Text style={styles.title}>{v.title}</Text>
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
            <WebView
              source={{ uri: embedUrl ?? sourceUrl }}
              style={styles.webview}
              javaScriptEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction
              onError={handleWebViewError}
            />
          ) : isPlayer && playerError ? (
            <View style={[styles.fillPoster, { backgroundColor: theme.colors.cardSoft }]}>
              <Feather name="eye-off" size={32} color={theme.colors.tertiary} />
              <Text style={styles.playerErrorTitle}>Embedding disabled</Text>
              <Text style={styles.playerErrorCopy}>
                This video cannot be embedded. Open it in the YouTube app instead.
              </Text>
              <Pressable style={styles.openInAppButton} onPress={openInYouTube}>
                <Feather name="external-link" size={16} color={theme.colors.white} />
                <Text style={styles.openInAppButtonText}>Open in YouTube</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.fillPoster, { backgroundColor: item.thumbnailColor }]}>
              <Feather name="film" size={32} color={theme.colors.white} />
            </View>
          )}
        </View>
      </View>

      {summary ? (
        <View style={styles.summaryCard}>
          <SectionHeader icon="align-left" title="Summary" />
          <Text style={styles.summaryBody}>{summary}</Text>
        </View>
      ) : null}

      {topic || formatVal || intent || audience || qualityScore !== undefined ? (
        <View style={styles.card}>
          <SectionHeader icon="cpu" title="AI Analysis" />
          {qualityScore !== undefined ? (
            <View style={styles.qualityBlock}>
              <View style={styles.qualityHeader}>
                <Text style={styles.qualityLabel}>Quality score</Text>
                <Text style={styles.qualityValue}>{qualityScore}<Text style={styles.qualityMax}>/100</Text></Text>
              </View>
              <View style={styles.qualityTrack}>
                <View style={[styles.qualityFill, { width: `${Math.min(100, Math.max(0, qualityScore))}%` }]} />
              </View>
            </View>
          ) : null}
          <View style={styles.infoGrid}>
            {topic ? (
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Topic</Text>
                <Text style={styles.infoValue}>{topic}</Text>
              </View>
            ) : null}
            {formatVal ? (
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Format</Text>
                <Text style={styles.infoValue}>{formatVal}</Text>
              </View>
            ) : null}
            {intent ? (
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Intent</Text>
                <Text style={styles.infoValue}>{intent}</Text>
              </View>
            ) : null}
            {audience ? (
              <View style={styles.infoBlock}>
                <Text style={styles.infoLabel}>Audience</Text>
                <Text style={styles.infoValue}>{audience}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {verticalType && verticalFields && verticalType !== 'general' ? (
        <View style={styles.card}>
          <SectionHeader
            icon="layers"
            title={`${verticalType.charAt(0).toUpperCase() + verticalType.slice(1).replace(/_/g, ' ')} details`}
          />
          <View style={styles.infoGrid}>
            {Object.entries(verticalFields).map(([key, val]) => {
              if (SKIP_VERTICAL_FIELDS.has(key)) return null;
              const label = VERTICAL_FIELD_LABELS[verticalType]?.[key] ?? key;
              const display = Array.isArray(val) ? val.join(', ') : String(val ?? '');
              if (!display) return null;
              return (
                <View key={key} style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{display}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {(caption || description || hashtags) ? (
        <View style={styles.card}>
          <SectionHeader icon="file-text" title="Original details" />
          {caption ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Caption</Text>
              <CollapsibleText text={caption} />
            </View>
          ) : null}
          {description ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Description</Text>
              <CollapsibleText text={description} />
            </View>
          ) : null}
          {hashtags ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Hashtags</Text>
              <HashtagList tags={hashtags} />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <SectionHeader icon="tag" title="Tags" />
        {userTags.length > 0 ? (
          <View style={styles.tagRow}>
            {userTags.map((tag) => (
              <View key={tag} style={styles.userTag}>
                <Text style={styles.userTagText}>{tag}</Text>
                <Pressable hitSlop={8} onPress={() => handleDeleteTag(tag)}>
                  <Feather name="x" size={12} color={theme.colors.secondary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedText}>No user tags yet</Text>
        )}

        {aiTags.length > 0 || analysisTags.length > 0 ? (
          <>
            <Text style={styles.tagGroupLabel}>Suggested</Text>
            <View style={styles.tagRow}>
              {(aiTags.length > 0 ? aiTags : analysisTags).map((tag) => (
                <View key={tag} style={styles.aiTag}>
                  <Text style={styles.aiTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {showTagInput ? (
          <View style={styles.tagInputRow}>
            <TextInput
              ref={tagInputRef}
              style={styles.tagInput}
              value={newTag}
              onChangeText={setNewTag}
              placeholder="Enter tag"
              placeholderTextColor={theme.colors.tertiary}
              onSubmitEditing={handleAddTag}
              returnKeyType="done"
            />
            <Pressable
              style={styles.tagAddButton}
              onPress={handleAddTag}
              disabled={tagSubmitting || !newTag.trim()}
            >
              {tagSubmitting ? (
                <ActivityIndicator size={12} color={theme.colors.card} />
              ) : (
                <Feather name="check" size={14} color={theme.colors.card} />
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addTagPill} onPress={() => setShowTagInput(true)}>
            <Feather name="plus" size={12} color={theme.colors.accent} />
            <Text style={styles.addTagText}>Add tag</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <SectionHeader icon="folder" title="Collections" />
        {hydrated && hydrated.collections.length > 0 ? (
          <View style={styles.tagRow}>
            {hydrated.collections.map((c) => (
              <View key={c.id} style={styles.collectionChip}>
                <Text style={styles.collectionChipText}>{c.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedText}>Not in any collection</Text>
        )}
        <Pressable style={styles.collectionButton} onPress={openCollectionPicker}>
          <Feather name="folder-plus" size={14} color={theme.colors.accent} />
          <Text style={styles.collectionButtonText}>Add to collection</Text>
        </Pressable>
      </View>

      <Pressable style={styles.linkButton} onPress={() => Linking.openURL(sourceUrl)}>
        <Feather name="external-link" size={16} color={theme.colors.card} />
        <Text style={styles.linkText}>Open original on {platformLabel}</Text>
      </Pressable>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Feather name="trash-2" size={16} color={theme.colors.danger} />
        <Text style={styles.deleteText}>Delete video</Text>
      </Pressable>

      <Modal visible={showCollectionPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to collection</Text>
              <Pressable onPress={() => setShowCollectionPicker(false)}>
                <Feather name="x" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalList}>
              {allCollections.map((c) => {
                const selected = pendingCollectionIds.has(c.id);
                return (
                  <Pressable
                    key={c.id}
                    style={styles.collectionRow}
                    onPress={() => handleToggleCollection(c.id)}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected && <Feather name="check" size={12} color={theme.colors.card} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.collectionRowName}>{c.name}</Text>
                      <Text style={styles.collectionRowCount}>{c.item_count} items</Text>
                    </View>
                  </Pressable>
                );
              })}
              {allCollections.length === 0 && (
                <Text style={styles.mutedText}>No collections yet</Text>
              )}
            </ScrollView>

            <Pressable
              style={styles.modalConfirm}
              onPress={handleSaveCollections}
              disabled={collectionSubmitting}
            >
              {collectionSubmitting ? (
                <ActivityIndicator size={16} color={theme.colors.card} />
              ) : (
                <Text style={styles.modalConfirmText}>Done</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
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
  qualityBlock: {
    marginBottom: 16,
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  qualityLabel: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  qualityValue: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  qualityMax: {
    color: theme.colors.tertiary,
    fontSize: 13,
    fontWeight: '500',
  },
  qualityTrack: {
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    overflow: 'hidden',
  },
  qualityFill: {
    height: '100%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.text,
  },
  tagGroupLabel: {
    color: theme.colors.tertiary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  moreTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  moreTagText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
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
  showMore: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  body: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  mutedText: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  fieldRow: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoBlock: {
    width: '48%',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardSoft,
    padding: 12,
  },
  infoLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    marginBottom: 6,
  },
  infoValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  userTagText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  aiTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
  },
  aiTagText: {
    color: theme.colors.secondary,
    fontSize: 12,
  },
  addTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
    marginTop: 10,
  },
  addTagText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  tagInput: {
    flex: 1,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    color: theme.colors.text,
    fontSize: 14,
  },
  tagAddButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  collectionChipText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  collectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  collectionButtonText: {
    color: theme.colors.accent,
    fontSize: 13,
    fontWeight: '600',
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
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modalList: {
    maxHeight: 300,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  collectionRowName: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  collectionRowCount: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  modalConfirm: {
    marginTop: 16,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: theme.colors.card,
    fontSize: 16,
    fontWeight: '700',
  },
});
