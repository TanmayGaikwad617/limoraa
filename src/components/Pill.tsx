import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

export function Pill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <View style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillActive: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  labelActive: {
    color: theme.colors.card,
    fontWeight: '700',
  },
});
