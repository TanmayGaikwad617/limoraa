import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { videos } from '../data/library';
import { VideoItem } from '../types';
import { MasonryColumns } from '../components/MasonryColumns';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

const quickFilters = ['All', 'TikTok', 'Instagram', 'YouTube', 'Recipes', 'Workouts', 'DIY', 'Education'];

export function HomeScreen({ onOpen }: { onOpen: (item: VideoItem) => void }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
            <Text style={styles.statLabel}>123 Saved</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statLabel}>8 Collections</Text>
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
          <Text style={styles.sectionTitle}>3 items being analyzed</Text>
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

      <MasonryColumns items={videos} onOpen={onOpen} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
});
