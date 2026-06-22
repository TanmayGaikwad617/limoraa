import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Dimensions, View } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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
import { CardRect } from './components/VideoCard';

type Ghost = { src: CardRect; dest: CardRect };

export function AppShell() {
  const [activeTab, setActiveTab] = useState<TabKey | 'detail' | 'collection-detail'>('home');
  const [selectedItem, setSelectedItem] = useState<VideoItem | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const detailSourceRef = useRef<TabKey>('home');
  const fabHidden = useSharedValue(0);
  const ghostProgress = useSharedValue(0);

  const isTab = (t: TabKey | 'detail' | 'collection-detail'): t is TabKey =>
    t !== 'detail' && t !== 'collection-detail';

  useEffect(() => {
    fabHidden.value = withTiming(0, { duration: 180 });
  }, [activeTab, fabHidden]);

  const openDetail = useCallback(
    (item: VideoItem, sourceRect?: CardRect) => {
      if (activeTab !== 'detail' && isTab(activeTab)) {
        detailSourceRef.current = activeTab;
      }
      setSelectedItem(item);
      setActiveTab('detail');

      if (sourceRect) {
        const screenWidth = Dimensions.get('window').width;
        const dest: CardRect = {
          x: 34,
          y: 110,
          width: screenWidth - 68,
          height: 240,
          color: sourceRect.color,
        };
        setGhost({ src: sourceRect, dest });
        ghostProgress.value = 0;
        ghostProgress.value = withTiming(1, { duration: 380 }, (finished) => {
          if (finished) runOnJS(setGhost)(null);
        });
      }
    },
    [activeTab, ghostProgress],
  );

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

  const handleSaved = useCallback(
    (result: { is_new: boolean; video: VideoItem | null }) => {
      if (result.video) {
        openDetail(result.video);
      }
    },
    [openDetail],
  );

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

  const ghostStyle = useAnimatedStyle(() => {
    if (!ghost) return { opacity: 0 };
    const p = ghostProgress.value;
    const srcCx = ghost.src.x + ghost.src.width / 2;
    const srcCy = ghost.src.y + ghost.src.height / 2;
    const destCx = ghost.dest.x + ghost.dest.width / 2;
    const destCy = ghost.dest.y + ghost.dest.height / 2;
    const targetScale = ghost.dest.width / Math.max(1, ghost.src.width);
    return {
      opacity: interpolate(p, [0, 0.75, 1], [1, 1, 0]),
      transform: [
        { translateX: (destCx - srcCx) * p },
        { translateY: (destCy - srcCy) * p },
        { scale: 1 + (targetScale - 1) * p },
      ],
    };
  }, [ghost]);

  return (
    <View style={{ flex: 1 }}>
      {activeTab === 'home' && <HomeScreen onOpen={openDetail} fabHidden={fabHidden} />}
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
          <FAB onPress={() => setShowSaveSheet(true)} hidden={fabHidden} />
        </>
      )}

      {ghost && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: ghost.src.x,
              top: ghost.src.y,
              width: ghost.src.width,
              height: ghost.src.height,
              backgroundColor: ghost.src.color,
              borderRadius: 16,
            },
            ghostStyle,
          ]}
        />
      )}

      <SaveSheet visible={showSaveSheet} onClose={() => setShowSaveSheet(false)} onSaved={handleSaved} />
    </View>
  );
}
