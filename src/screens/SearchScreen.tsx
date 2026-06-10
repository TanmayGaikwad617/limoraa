import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { videos } from '../data/library';
import { VideoItem } from '../types';
import { MasonryColumns } from '../components/MasonryColumns';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

const recentSearches = ['meal prep', 'ai tools', 'workout'];
const suggestedFilters = ['Recipes', 'Education', 'DIY'];

export function SearchScreen({
  value,
  onChange,
  onOpen,
}: {
  value: string;
  onChange: (value: string) => void;
  onOpen: (item: VideoItem) => void;
}) {
  const filtered = videos.filter((item) => {
    const needle = value.trim().toLowerCase();
    if (!needle) {
      return true;
    }

    return [
      item.title,
      item.creator,
      item.summary,
      item.tags.join(' '),
      item.collection,
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Search</Text>
        <Text style={styles.title}>Find saved content instantly</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="Search videos..."
          placeholderTextColor={theme.colors.muted}
        />
      </View>

      <View>
        <Text style={styles.groupTitle}>Recent searches</Text>
        <View style={styles.pillRow}>
          {recentSearches.map((item) => (
            <Pill key={item} label={item} />
          ))}
        </View>
      </View>

      <View>
        <Text style={styles.groupTitle}>Suggested filters</Text>
        <View style={styles.pillRow}>
          {suggestedFilters.map((item) => (
            <Pill key={item} label={item} />
          ))}
        </View>
      </View>

      <View style={styles.resultsHeader}>
        <View>
          <Text style={styles.eyebrow}>Results</Text>
          <Text style={styles.resultsTitle}>{value || 'All saved videos'}</Text>
        </View>
        <Text style={styles.matchLabel}>Best matches</Text>
      </View>

      <MasonryColumns items={filtered} onOpen={onOpen} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  headerCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 8,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
  },
  input: {
    minHeight: 50,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.cardSoft,
    marginTop: 14,
    paddingHorizontal: 14,
    color: theme.colors.text,
    fontSize: 14,
  },
  groupTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  resultsTitle: {
    color: theme.colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  matchLabel: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
});
