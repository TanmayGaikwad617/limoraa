import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { CollectionItem } from '../types';
import { theme } from '../theme';

const ICON_FALLBACK = 'folder';

export function CollectionCard({
  item,
  onPress,
}: {
  item: CollectionItem;
  onPress?: () => void;
}) {
  const iconName = (item.icon ?? ICON_FALLBACK) as keyof typeof Feather.glyphMap;

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.iconRow}>
        <View style={styles.iconCircle}>
          <Feather name={iconName in Feather.glyphMap ? iconName : ICON_FALLBACK} size={20} color={theme.colors.accent} />
        </View>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{item.type === 'smart' ? 'Smart' : 'Manual'}</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>

      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.count}>{item.item_count} {item.item_count === 1 ? 'item' : 'items'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  pressed: {
    opacity: 0.85,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
  },
  typeText: {
    color: theme.colors.secondary,
    fontSize: 10,
    fontWeight: '600',
  },
  name: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  count: {
    color: theme.colors.muted,
    fontSize: 12,
  },
});
