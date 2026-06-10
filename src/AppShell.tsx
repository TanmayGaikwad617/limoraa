import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { videos } from './data/library';
import { TabKey, VideoItem } from './types';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { BottomTabs } from './components/BottomTabs';

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [selectedId, setSelectedId] = useState<string>(videos[0]?.id ?? '');
  const [query, setQuery] = useState('meal prep');

  const selectedItem = useMemo<VideoItem | null>(
    () => videos.find((item) => item.id === selectedId) ?? null,
    [selectedId],
  );

  const openDetail = (item: VideoItem) => {
    setSelectedId(item.id);
    setActiveTab('detail');
  };

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'home' && <HomeScreen onOpen={openDetail} />}
      {activeTab === 'search' && <SearchScreen value={query} onChange={setQuery} onOpen={openDetail} />}
      {activeTab === 'collections' && <CollectionsScreen />}
      {activeTab === 'detail' && <DetailScreen item={selectedItem} />}
      {activeTab === 'profile' && <ProfileScreen />}

      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}
