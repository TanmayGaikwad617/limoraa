import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { VideoItem } from '../types';
import { theme } from '../theme';

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  fetching_metadata: 'Fetching metadata',
  analyzing: 'Analyzing',
  failed: 'Failed',
};

export function VideoCard({
  item,
  onPress,
  onRetry,
  tall = false,
}: {
  item: VideoItem;
  onPress: () => void;
  onRetry?: () => void;
  tall?: boolean;
}) {
  const isReady = item.status === 'Ready';
  const isFailed = item.status === 'failed';
  const isProcessing = !isReady && !isFailed;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.thumbnail, { backgroundColor: item.thumbnailColor, minHeight: tall ? 220 : 168 }]}>
        <View style={styles.platformChip}>
          <Text style={styles.platformText}>{item.platform}</Text>
        </View>

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

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{item.creator}</Text>
      <Text style={styles.caption}>{item.summary}</Text>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{item.type}</Text>
        <Text style={styles.footerText}>{item.savedAgo}</Text>
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.9,
  },
  thumbnail: {
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
