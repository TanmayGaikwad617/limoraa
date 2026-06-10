import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CollectionItem } from '../types';
import { theme } from '../theme';

export function CollectionCard({ item }: { item: CollectionItem }) {
  return (
    <View style={styles.card}>
      <View style={styles.coverGrid}>
        {item.cover.map((color, index) => (
          <View key={`${item.id}-${index}`} style={[styles.coverTile, { backgroundColor: color }]} />
        ))}
      </View>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.kind}>{item.kind}</Text>
          <Text style={styles.count}>{item.itemCount} items</Text>
        </View>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.note}>{item.note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  coverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  coverTile: {
    width: '50%',
    height: 54,
  },
  body: {
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  kind: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  count: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  name: {
    color: theme.colors.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  note: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
});
