import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';

import { VideoItem } from '../types';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

export function DetailScreen({ item }: { item: VideoItem | null }) {
  if (!item) {
    return (
      <View style={styles.emptyState}>
        <Feather name="play-circle" size={30} color={theme.colors.muted} />
        <Text style={styles.emptyTitle}>Open a saved video</Text>
        <Text style={styles.emptyCopy}>
          Tap any thumbnail from Home or Search to open the detail view and try the platform embed.
        </Text>
      </View>
    );
  }

  const playerMode = getPlayerMode(item);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.playerCard}>
        <View style={styles.playerHeader}>
          <View>
            <Text style={styles.eyebrow}>Detail</Text>
            <Text style={styles.title}>{item.title}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.platform}</Text>
          </View>
        </View>

        <View style={styles.playerFrame}>
          {playerMode === 'webview' && item.embedUrl ? (
            <WebView
              source={{ uri: item.embedUrl }}
              style={styles.webview}
              javaScriptEnabled
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction
            />
          ) : (
            <View style={[styles.fallbackPoster, { backgroundColor: item.thumbnailColor }]}>
              <Text style={styles.fallbackTitle}>Embed fallback</Text>
              <Text style={styles.fallbackCopy}>
                Public embeds can fail or be restricted. Keep the thumbnail, metadata, and source link as the safe path.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.strategyRow}>
          <Pill label={item.platform === 'YouTube' ? 'YouTube embed' : item.platform === 'TikTok' ? 'TikTok embed' : 'Instagram public embed'} active />
          <Pill label="Thumbnail fallback" />
        </View>
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.metaTitle}>{item.creator}</Text>
        <Text style={styles.summary}>{item.summary}</Text>

        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <Pill key={tag} label={tag} />
          ))}
        </View>

        <View style={styles.infoGrid}>
          <InfoBlock label="Collection" value={item.collection} />
          <InfoBlock label="Type" value={item.type} />
          <InfoBlock label="Status" value={item.status} />
          <InfoBlock label="Saved" value={item.savedAgo} />
        </View>

        <Pressable style={styles.linkButton} onPress={() => Linking.openURL(item.sourceUrl)}>
          <Feather name="external-link" size={16} color={theme.colors.card} />
          <Text style={styles.linkText}>Open original</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function getPlayerMode(item: VideoItem) {
  if (item.platform === 'YouTube' || item.platform === 'TikTok') {
    return 'webview';
  }

  return item.embedUrl ? 'webview' : 'fallback';
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
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
  playerCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  playerHeader: {
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
    maxWidth: 260,
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
    minHeight: 360,
  },
  webview: {
    height: 360,
    backgroundColor: theme.colors.cardSoft,
  },
  fallbackPoster: {
    minHeight: 360,
    padding: 20,
    justifyContent: 'flex-end',
  },
  fallbackTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  fallbackCopy: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 260,
  },
  strategyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metaCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  metaTitle: {
    color: theme.colors.rust,
    fontSize: 13,
    marginBottom: 10,
  },
  summary: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
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
  linkButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    backgroundColor: theme.colors.text,
  },
  linkText: {
    color: theme.colors.card,
    fontSize: 14,
    fontWeight: '700',
  },
});
