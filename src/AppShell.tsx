import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { TabKey, VideoItem } from './types';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { DetailScreen } from './screens/DetailScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { BottomTabs } from './components/BottomTabs';

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [selectedItem, setSelectedItem] = useState<VideoItem | null>(null);

  const openDetail = useCallback((item: VideoItem) => {
    setSelectedItem(item);
    setActiveTab('detail');
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'home' && <HomeScreen onOpen={openDetail} />}
      {activeTab === 'search' && <SearchScreen onOpen={openDetail} />}
      {activeTab === 'collections' && <CollectionsScreen />}
      {activeTab === 'detail' && <DetailScreen item={selectedItem} />}
      {activeTab === 'profile' && <ProfileScreen />}

      <BottomTabs activeTab={activeTab} onChange={setActiveTab} />
    </View>
  );
}
