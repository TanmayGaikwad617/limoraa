import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { theme } from '../theme';

export function FAB({
  onPress,
  hidden,
}: {
  onPress: () => void;
  hidden?: SharedValue<number>;
}) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.88, { damping: 15, stiffness: 220 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => {
    const hideAmount = hidden?.value ?? 0;
    const translateY = interpolate(hideAmount, [0, 1], [0, 140]);
    return {
      transform: [{ translateY }, { scale: scale.value }],
      opacity: interpolate(hideAmount, [0, 1], [1, 0]),
    };
  });

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.button}
      >
        <Feather name="plus" size={32} color={theme.colors.white} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 28,
    right: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
