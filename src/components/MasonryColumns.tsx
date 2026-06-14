import React from 'react';
import { StyleSheet, View } from 'react-native';

import { VideoItem } from '../types';
import { VideoCard } from './VideoCard';

export function MasonryColumns({
  items,
  onOpen,
  onRetry,
}: {
  items: VideoItem[];
  onOpen: (item: VideoItem) => void;
  onRetry?: (item: VideoItem) => void;
}) {
  const left = items.filter((_, index) => index % 2 === 0);
  const right = items.filter((_, index) => index % 2 === 1);

  return (
    <View style={styles.grid}>
      <View style={styles.column}>
        {left.map((item, index) => (
          <VideoCard key={item.id} item={item} onPress={() => onOpen(item)} tall={index % 2 === 0} onRetry={onRetry ? () => onRetry(item) : undefined} />
        ))}
      </View>
      <View style={styles.column}>
        {right.map((item, index) => (
          <VideoCard key={item.id} item={item} onPress={() => onOpen(item)} tall={index % 2 !== 0} onRetry={onRetry ? () => onRetry(item) : undefined} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 12,
  },
});
