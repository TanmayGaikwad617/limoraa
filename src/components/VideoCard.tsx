import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VideoItem } from '../types';
import { theme } from '../theme';

export function VideoCard({
  item,
  onPress,
  tall = false,
}: {
  item: VideoItem;
  onPress: () => void;
  tall?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.thumbnail, { backgroundColor: item.thumbnailColor, minHeight: tall ? 220 : 168 }]}>
        <View style={styles.platformChip}>
          <Text style={styles.platformText}>{item.platform}</Text>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
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
    alignSelf: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,253,248,0.78)',
  },
  statusText: {
    color: theme.colors.muted,
    fontSize: 11,
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
