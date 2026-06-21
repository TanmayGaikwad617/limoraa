import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';

import { TabKey, VideoItem } from './types';
import { HomeScreen } from './screens/HomeScreen';
import { SearchScreen } from './screens/SearchScreen';
import { CollectionsScreen } from './screens/CollectionsScreen';
import { CollectionDetailScreen } from './screens/CollectionDetailScreen';
import { DetailScreen } from './screens/DetailScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { BottomTabs } from './components/BottomTabs';
import { FAB } from './components/FAB';
import { SaveSheet } from './components/SaveSheet';

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey | 'detail' | 'collection-detail'>('home');
  const [selectedItem, setSelectedItem] = useState<VideoItem | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
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

  const handleSaved = useCallback((result: { is_new: boolean; video: VideoItem | null }) => {
    if (result.video) {
      openDetail(result.video);
    }
  }, [openDetail]);

  useEffect(() => {
    const onBackPress = () => {
      if (activeTab === 'detail') {
        closeDetail();
        return true;
      }
      if (activeTab === 'collection-detail') {
        closeCollectionDetail();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [activeTab, closeDetail, closeCollectionDetail]);

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

      {isTab(activeTab) && (
        <>
          <BottomTabs activeTab={activeTab} onChange={setActiveTab as (tab: TabKey) => void} />
          <FAB onPress={() => setShowSaveSheet(true)} />
        </>
      )}

      <SaveSheet visible={showSaveSheet} onClose={() => setShowSaveSheet(false)} onSaved={handleSaved} />
    </View>
  );
}
