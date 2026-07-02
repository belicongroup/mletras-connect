import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ComposerModal } from '../components/ComposerModal';
import { DrawerMenu } from '../components/DrawerMenu';
import { Fab } from '../components/Fab';
import { FeedHeader } from '../components/FeedHeader';
import { FeedPost } from '../components/FeedPost';
import { useApp } from '../context/AppContext';
import { Post, RootStackParamList } from '../types';
import { colors, layout } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

export function FeedScreen({ navigation }: Props) {
  const { currentUser, posts, users, toggleLike, addPost, signOut } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const slideAnim = useRef(new Animated.Value(-280)).current;

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [slideAnim]);

  const closeDrawer = useCallback(() => {
    Animated.timing(slideAnim, { toValue: -280, duration: 200, useNativeDriver: true }).start(
      () => setDrawerOpen(false),
    );
  }, [slideAnim]);

  const handleSubmitPost = useCallback(async () => {
    if (!composerText.trim()) return;

    await addPost({
      text: composerText,
      imageUrl: hasImage ? 'placeholder' : undefined,
      videoUrl: hasVideo ? 'placeholder' : undefined,
    });

    setComposerText('');
    setHasImage(false);
    setHasVideo(false);
    setComposerOpen(false);
  }, [addPost, composerText, hasImage, hasVideo]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const renderItem = useCallback(
    ({ item }: { item: Post }) => {
      const author = users[item.authorId];
      if (!author) return null;
      return <FeedPost post={item} author={author} onLike={toggleLike} />;
    },
    [toggleLike, users],
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  if (!currentUser) return null;

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <FeedHeader user={currentUser} onAvatarPress={openDrawer} />
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
        <Fab onPress={() => setComposerOpen(true)} />
      </View>

      <DrawerMenu
        visible={drawerOpen}
        user={currentUser}
        slideAnim={slideAnim}
        onClose={closeDrawer}
        onEditProfile={() => navigation.navigate('EditProfile')}
        onProfile={() => navigation.navigate('Profile')}
        onSettings={() => navigation.navigate('Settings')}
        onSignOut={handleSignOut}
      />

      <ComposerModal
        visible={composerOpen}
        text={composerText}
        hasImage={hasImage}
        hasVideo={hasVideo}
        onChangeText={setComposerText}
        onToggleImage={() => {
          setHasImage((current) => {
            const next = !current;
            if (next) setHasVideo(false);
            return next;
          });
        }}
        onToggleVideo={() => {
          setHasVideo((current) => {
            const next = !current;
            if (next) setHasImage(false);
            return next;
          });
        }}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleSubmitPost}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  list: {
    paddingBottom: 100,
  },
});
