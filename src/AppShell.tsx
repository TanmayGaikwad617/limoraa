import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import { TabKey, VideoItem } from './types';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { CollectionDetailScreen } from './screens/CollectionDetailScreen';
import { DetailScreen } from './screens/DetailScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { BottomTabs } from './components/BottomTabs';

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey | 'detail' | 'collection-detail'>('home');
  const [selectedItem, setSelectedItem] = useState<VideoItem | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const detailSourceRef = useRef<TabKey>('home');

  const isTab = (t: TabKey | 'detail' | 'collection-detail'): t is TabKey =>
    t !== 'detail' && t !== 'collection-detail';

  const openDetail = useCallback((item: VideoItem) => {
    if (activeTab !== 'detail' && isTab(activeTab)) {
      detailSourceRef.current = activeTab;
    }
    setSelectedItem(item);
    setActiveTab('detail');
  }, [activeTab]);

  const closeDetail = useCallback(() => {
    setSelectedItem(null);
    setActiveTab(detailSourceRef.current);
  }, []);

  const handleDelete = useCallback((_videoId: string) => {
    setSelectedItem(null);
    setActiveTab(detailSourceRef.current);
  }, []);

  const openCollectionDetail = useCallback((collectionId: string) => {
    setSelectedCollectionId(collectionId);
    setActiveTab('collection-detail');
  }, []);

  const closeCollectionDetail = useCallback(() => {
    setSelectedCollectionId(null);
    setActiveTab('collections');
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'home' && <HomeScreen onOpen={openDetail} />}
      {activeTab === 'search' && <SearchScreen onOpen={openDetail} />}
      {activeTab === 'collections' && (
        <CollectionsScreen onOpenCollection={openCollectionDetail} />
      )}
      {activeTab === 'collection-detail' && selectedCollectionId && (
        <CollectionDetailScreen
          collectionId={selectedCollectionId}
          onClose={closeCollectionDetail}
          onOpen={openDetail}
        />
      )}
      {activeTab === 'detail' && (
        <DetailScreen item={selectedItem} onClose={closeDetail} onDelete={handleDelete} />
      )}
      {activeTab === 'profile' && <ProfileScreen />}

      {isTab(activeTab) && <BottomTabs activeTab={activeTab} onChange={setActiveTab as (tab: TabKey) => void} />}
    </View>
  );
}
