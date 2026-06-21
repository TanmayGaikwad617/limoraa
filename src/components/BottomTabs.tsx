import React, { useCallback, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

import { TabKey } from '../types';
import { theme } from '../theme';

const TAB_ITEMS: { key: TabKey; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'search', icon: 'search', label: 'Search' },
  { key: 'collections', icon: 'grid', label: 'Collections' },
  { key: 'profile', icon: 'user', label: 'Profile' },
];

export function BottomTabs({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const scales = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(
      TAB_ITEMS.map((t) => [t.key, new Animated.Value(t.key === activeTab ? 1 : 0.92)]),
    ),
  ).current;

  const handlePress = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) return;

      Animated.spring(scales[tab], {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();

      Animated.spring(scales[activeTab], {
        toValue: 0.92,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();

      onChange(tab);
    },
    [activeTab, onChange, scales],
  );

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {TAB_ITEMS.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <Pressable
              key={tab.key}
              onPress={() => handlePress(tab.key)}
              style={styles.button}
            >
              <Animated.View style={[styles.iconWrap, { transform: [{ scale: scales[tab.key] }] }]}>
                <Feather
                  name={tab.icon}
                  size={22}
                  color={active ? theme.colors.text : theme.colors.tertiary}
                />
              </Animated.View>
              <Text
                style={[
                  styles.label,
                  { color: active ? theme.colors.text : theme.colors.tertiary },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
    left: 16,
    right: 104,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 80,
    borderRadius: 44,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
});
