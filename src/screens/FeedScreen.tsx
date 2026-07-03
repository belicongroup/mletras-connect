import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ComposerModal } from '../components/ComposerModal';
import { DrawerMenu } from '../components/DrawerMenu';
import { Fab } from '../components/Fab';
import { FeedHeader } from '../components/FeedHeader';
import { FeedPost } from '../components/FeedPost';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { uploadImage } from '../services/postsService';
import { Post, RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

interface PickedImage {
  uri: string;
  mimeType: string;
}

export function FeedScreen({ navigation }: Props) {
  const {
    currentUser,
    posts,
    users,
    toggleLike,
    addPost,
    signOut,
    feedRefreshing,
    feedLoadingMore,
    feedHasMore,
    refreshFeed,
    loadMoreFeed,
  } = useApp();
  const { strings } = useAuthLanguage();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    setComposerText('');
    setPickedImage(null);
  }, []);

  const handlePickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPickedImage({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
    }
  }, []);

  const handleSubmitPost = useCallback(async () => {
    if ((!composerText.trim() && !pickedImage) || submitting) return;

    setSubmitting(true);
    let media;
    if (pickedImage) {
      const uploaded = await uploadImage(pickedImage.uri, pickedImage.mimeType);
      if (!uploaded) {
        setSubmitting(false);
        return;
      }
      media = [uploaded];
    }

    const result = await addPost({ text: composerText, media });
    setSubmitting(false);

    if (result.ok) {
      closeComposer();
    }
  }, [addPost, closeComposer, composerText, pickedImage, submitting]);

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

  const renderFooter = useCallback(() => {
    if (!feedLoadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }, [feedLoadingMore]);

  const renderEmpty = useCallback(() => {
    if (feedRefreshing) return null;
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{strings.noPostsYet}</Text>
      </View>
    );
  }, [feedRefreshing, strings.noPostsYet]);

  if (!currentUser) return null;

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <FeedHeader
          user={currentUser}
          unreadCount={0}
          onAvatarPress={openDrawer}
          onNotificationsPress={() => navigation.navigate('Notifications')}
        />
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={posts.length === 0 ? styles.listEmpty : styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={feedRefreshing}
              onRefresh={refreshFeed}
              tintColor={colors.primary}
            />
          }
          onEndReached={feedHasMore ? loadMoreFeed : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
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
        imageUri={pickedImage?.uri ?? null}
        submitting={submitting}
        onChangeText={setComposerText}
        onPickImage={handlePickImage}
        onRemoveImage={() => setPickedImage(null)}
        onClose={closeComposer}
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
  listEmpty: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  footer: {
    paddingVertical: spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
