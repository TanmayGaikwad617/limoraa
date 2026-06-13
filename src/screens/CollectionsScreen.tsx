import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { fetchCollections } from '../data/library';
import { CollectionItem } from '../types';
import { CollectionCard } from '../components/CollectionCard';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

export function CollectionsScreen() {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCollections()
      .then((res) => {
        if (!cancelled) setCollections(res.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>Collections</Text>
        <Text style={styles.title}>Boards for what you actually want to keep</Text>
        <Text style={styles.subtitle}>
          Manual for intention, smart for patterns. Both should still feel visual and light.
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pill label="Manual" active />
        <Pill label="Smart" />
        <Pill label="Create collection" />
      </View>

      <View style={styles.grid}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.text} />
        ) : (
          collections.map((item) => (
            <CollectionCard key={item.id} item={item} />
          ))
        )}
      </View>
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
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
});
