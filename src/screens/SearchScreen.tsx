import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { searchVideos } from '../data/library';
import { VideoItem } from '../types';
import { MasonryColumns } from '../components/MasonryColumns';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

const recentSearches = ['meal prep', 'ai tools', 'workout'];
const suggestedFilters = ['Recipes', 'Education', 'DIY'];
const DEBOUNCE_MS = 300;

export function SearchScreen({ onOpen }: { onOpen: (item: VideoItem) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const items = await searchVideos({ q: q.trim() });
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(text), DEBOUNCE_MS);
  }, [doSearch]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showSuggestions = !searched || !query.trim();

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Search</Text>
        <Text style={styles.title}>Find saved content instantly</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onChangeText}
          placeholder="Search videos..."
          placeholderTextColor={theme.colors.muted}
        />
      </View>

      {showSuggestions ? (
        <>
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
        </>
      ) : loading ? (
        <ActivityIndicator size="large" color={theme.colors.text} style={{ marginTop: 32 }} />
      ) : (
        <>
          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.eyebrow}>Results</Text>
              <Text style={styles.resultsTitle}>
                {results.length > 0
                  ? `${results.length} match${results.length === 1 ? '' : 'es'}`
                  : 'No results'}
              </Text>
            </View>
            <Text style={styles.matchLabel}>Best matches</Text>
          </View>

          {results.length > 0 && <MasonryColumns items={results} onOpen={onOpen} />}
        </>
      )}
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
