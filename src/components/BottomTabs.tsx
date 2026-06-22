import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { TabKey } from '../types';
import { theme } from '../theme';

const TAB_ITEMS: { key: TabKey; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'home', icon: 'home', label: 'Home' },
  { key: 'search', icon: 'search', label: 'Search' },
  { key: 'collections', icon: 'grid', label: 'Collections' },
  { key: 'profile', icon: 'user', label: 'Profile' },
];

const SPRING = { damping: 18, stiffness: 240, mass: 0.8 };

function TabButton({
  tab,
  active,
  onPress,
}: {
  tab: (typeof TAB_ITEMS)[number];
  active: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(active ? 1 : 0.92);

  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.92, SPRING);
  }, [active, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.button}>
      <Animated.View style={[styles.iconWrap, iconStyle]}>
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
}

export function BottomTabs({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const [tabWidth, setTabWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const activeIndex = TAB_ITEMS.findIndex((t) => t.key === activeTab);

  useEffect(() => {
    if (tabWidth === 0) return;
    indicatorX.value = withSpring(activeIndex * tabWidth, SPRING);
  }, [activeIndex, tabWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: indicatorX.value }],
  }));

  const handlePress = useCallback(
    (tab: TabKey) => {
      if (tab === activeTab) return;
      onChange(tab);
    },
    [activeTab, onChange],
  );

  return (
    <View style={styles.container}>
      <View
        style={styles.bar}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          const inner = w - 12;
          setTabWidth(inner / TAB_ITEMS.length);
        }}
      >
        {tabWidth > 0 && (
          <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none" />
        )}
        {TAB_ITEMS.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            active={tab.key === activeTab}
            onPress={() => handlePress(tab.key)}
          />
        ))}
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
  indicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 6,
    borderRadius: 36,
    backgroundColor: theme.colors.cardSoft,
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
