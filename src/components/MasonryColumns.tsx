import React from 'react';
import { StyleSheet, View } from 'react-native';

import { VideoItem } from '../types';
import { VideoCard, CardRect } from './VideoCard';

export function MasonryColumns({
  items,
  onOpen,
  onRetry,
  onDelete,
  onMoveToCollection,
}: {
  items: VideoItem[];
  onOpen: (item: VideoItem, sourceRect?: CardRect) => void;
  onRetry?: (item: VideoItem) => void;
  onDelete?: (item: VideoItem) => void;
  onMoveToCollection?: (item: VideoItem) => void;
}) {
  const left: { item: VideoItem; globalIndex: number }[] = [];
  const right: { item: VideoItem; globalIndex: number }[] = [];
  items.forEach((item, globalIndex) => {
    (globalIndex % 2 === 0 ? left : right).push({ item, globalIndex });
  });

  return (
    <View style={styles.grid}>
      <View style={styles.column}>
        {left.map(({ item, globalIndex }, index) => (
          <VideoCard
            key={item.id}
            item={item}
            index={globalIndex}
            onPress={(rect) => onOpen(item, rect)}
            tall={index % 2 === 0}
            onRetry={onRetry ? () => onRetry(item) : undefined}
            onDelete={onDelete ? () => onDelete(item) : undefined}
            onMoveToCollection={onMoveToCollection ? () => onMoveToCollection(item) : undefined}
          />
        ))}
      </View>
      <View style={styles.column}>
        {right.map(({ item, globalIndex }, index) => (
          <VideoCard
            key={item.id}
            item={item}
            index={globalIndex}
            onPress={(rect) => onOpen(item, rect)}
            tall={index % 2 !== 0}
            onRetry={onRetry ? () => onRetry(item) : undefined}
            onDelete={onDelete ? () => onDelete(item) : undefined}
            onMoveToCollection={onMoveToCollection ? () => onMoveToCollection(item) : undefined}
          />
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
