import React, { useCallback, useRef } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';

import { VideoItem } from '../types';
import { theme } from '../theme';

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  fetching_metadata: 'Fetching metadata',
  analyzing: 'Analyzing',
  failed: 'Failed',
};

export type CardRect = { x: number; y: number; width: number; height: number; color: string };

export function VideoCard({
  item,
  onPress,
  onRetry,
  onDelete,
  onMoveToCollection,
  tall = false,
  index = 0,
}: {
  item: VideoItem;
  onPress: (sourceRect?: CardRect) => void;
  onRetry?: () => void;
  onDelete?: () => void;
  onMoveToCollection?: () => void;
  tall?: boolean;
  index?: number;
}) {
  const isReady = item.status === 'Ready';
  const isFailed = item.status === 'failed';
  const isProcessing = !isReady && !isFailed;

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 260 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 180 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));

  const leftActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-60, 0], [1, 0], 'clamp'),
  }));

  const rightActionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, 60], [0, 1], 'clamp'),
  }));

  const enterDelay = Math.min(index, 12) * 40;

  const thumbnailRef = useRef<View>(null);
  const handlePress = useCallback(() => {
    const node = thumbnailRef.current;
    if (!node || !node.measureInWindow) {
      onPress();
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || width === 0) {
        onPress();
        return;
      }
      onPress({ x, y, width, height, color: item.thumbnailColor });
    });
  }, [item.thumbnailColor, onPress]);

  const swipeEnabled = !!(onDelete || onMoveToCollection);
  const cardWidth = Dimensions.get('window').width / 2;
  const COMMIT_RATIO = 0.3;
  const COMMIT_VELOCITY = 800;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .enabled(swipeEnabled)
    .onUpdate((e) => {
      let dx = e.translationX;
      if (!onDelete && dx < 0) dx = 0;
      if (!onMoveToCollection && dx > 0) dx = 0;
      translateX.value = dx;
    })
    .onEnd((e) => {
      const dx = translateX.value;
      const past = Math.abs(dx) > cardWidth * COMMIT_RATIO;
      const fast = Math.abs(e.velocityX) > COMMIT_VELOCITY;
      if (past || fast) {
        const target = dx < 0 ? -cardWidth * 1.2 : cardWidth * 1.2;
        translateX.value = withTiming(target, { duration: 200 }, () => {
          if (dx < 0 && onDelete) {
            runOnJS(onDelete)();
          } else if (dx > 0 && onMoveToCollection) {
            runOnJS(onMoveToCollection)();
          }
        });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const cardContent = (
    <Animated.View style={animatedStyle}>
      <Pressable style={styles.card} onPress={handlePress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <View
          ref={thumbnailRef}
          collapsable={false}
          style={[styles.thumbnail, { backgroundColor: item.thumbnailColor, minHeight: tall ? 220 : 168 }]}
        >
          {item.thumbnailUrl ? (
            <Image
              source={{ uri: item.thumbnailUrl }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          ) : null}

          <View style={styles.thumbnailOverlay}>
            <View style={styles.platformChip}>
              <Text style={styles.platformText}>{item.platform}</Text>
            </View>

            <View>
              {!isReady && (
                <View style={styles.statusChip}>
                  {isProcessing && (
                    <ActivityIndicator size={10} color={theme.colors.muted} style={{ marginRight: 4 }} />
                  )}
                  <Text style={styles.statusText}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Text>
                </View>
              )}

              {isFailed && onRetry && (
                <Pressable style={styles.retryChip} onPress={onRetry}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <View style={[styles.textBlock, isProcessing && styles.textBlockSkeleton]}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>{item.creator}</Text>
          <Text style={styles.caption}>{item.summary}</Text>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{item.type}</Text>
            <Text style={styles.footerText}>{item.savedAgo}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <Animated.View entering={FadeInDown.delay(enterDelay).duration(320)}>
      <View style={styles.swipeStack}>
        {onMoveToCollection ? (
          <Animated.View style={[styles.actionBg, styles.actionLeft, rightActionStyle]}>
            <Feather name="folder-plus" size={18} color={theme.colors.white} />
            <Text style={styles.actionLabel}>Move</Text>
          </Animated.View>
        ) : null}
        {onDelete ? (
          <Animated.View style={[styles.actionBg, styles.actionRight, leftActionStyle]}>
            <Feather name="trash-2" size={18} color={theme.colors.white} />
            <Text style={styles.actionLabel}>Delete</Text>
          </Animated.View>
        ) : null}
        {swipeEnabled ? (
          <GestureDetector gesture={panGesture}>{cardContent}</GestureDetector>
        ) : (
          cardContent
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  swipeStack: {
    position: 'relative',
  },
  actionBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLeft: {
    left: 0,
    backgroundColor: theme.colors.accent,
  },
  actionRight: {
    right: 0,
    backgroundColor: theme.colors.danger,
  },
  actionLabel: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  thumbnail: {
    overflow: 'hidden',
  },
  thumbnailImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  platformChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  platformText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: '600',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(245,245,245,0.82)',
  },
  statusText: {
    color: theme.colors.secondary,
    fontSize: 11,
    fontWeight: '500',
  },
  retryChip: {
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(245,245,245,0.82)',
    marginTop: 4,
  },
  retryText: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 23,
    marginTop: 12,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  meta: {
    color: theme.colors.rust,
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 12,
  },
  textBlock: {
    paddingBottom: 0,
  },
  textBlockSkeleton: {
    minHeight: 112,
    justifyContent: 'flex-start',
  },
  caption: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    color: theme.colors.muted,
    fontSize: 11,
  },
});
