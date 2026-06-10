import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Pill } from '../components/Pill';
import { theme } from '../theme';

export function ProfileScreen() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Profile</Text>
        <Text style={styles.title}>Free plan, private by default</Text>
        <Text style={styles.subtitle}>Upgrade for AI summaries, categorization, and smarter boards.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Usage</Text>
        <UsageRow label="Saves" value="42 / 100" />
        <UsageRow label="AI analyses" value="15 / 25" />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Upgrade</Text>
        <View style={styles.pillRow}>
          <Pill label="Unlimited saves" />
          <Pill label="AI summaries" />
          <Pill label="Smart collections" />
          <Pill label="Advanced filters" />
        </View>
      </View>
    </ScrollView>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.usageRow}>
      <Text style={styles.usageLabel}>{label}</Text>
      <Text style={styles.usageValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  card: {
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
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  usageLabel: {
    color: theme.colors.muted,
    fontSize: 14,
  },
  usageValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
});
