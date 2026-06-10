import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { collections } from '../data/library';
import { CollectionCard } from '../components/CollectionCard';
import { Pill } from '../components/Pill';
import { theme } from '../theme';

export function CollectionsScreen() {
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
        {collections.map((item) => (
          <CollectionCard key={item.id} item={item} />
        ))}
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
