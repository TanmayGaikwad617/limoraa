import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { TabKey } from '../types';
import { theme } from '../theme';

const icons: Record<TabKey, keyof typeof Feather.glyphMap> = {
  home: 'home',
  search: 'search',
  collections: 'grid',
  detail: 'play-circle',
  profile: 'user',
};

const labels: Record<TabKey, string> = {
  home: 'Home',
  search: 'Search',
  collections: 'Collections',
  detail: 'Detail',
  profile: 'Profile',
};

export function BottomTabs({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.bar}>
      {(Object.keys(labels) as TabKey[]).map((tab) => {
        const active = tab === activeTab;

        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            style={({ pressed }) => [styles.button, active && styles.buttonActive, pressed && styles.pressed]}
          >
            <Feather
              name={icons[tab]}
              size={18}
              color={active ? theme.colors.text : theme.colors.muted}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{labels[tab]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.canvas,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
  },
  buttonActive: {
    backgroundColor: theme.colors.card,
  },
  pressed: {
    opacity: 0.84,
  },
  label: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  labelActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
});
