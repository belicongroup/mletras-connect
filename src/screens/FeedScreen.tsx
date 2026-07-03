import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ComposerModal, PickedMedia } from '../components/ComposerModal';
import { DrawerMenu } from '../components/DrawerMenu';
import { Fab } from '../components/Fab';
import { FeedHeader } from '../components/FeedHeader';
import { FeedPost } from '../components/FeedPost';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { useCollapsingHeader } from '../hooks/useCollapsingHeader';
import {
  getMediaStatus,
  uploadImage,
  uploadVideo,
  type UploadedMedia,
} from '../services/mediaService';
import { Post, RootStackParamList } from '../types';
import { colors, layout, spacing, typography } from '../theme';
import { showAlert } from '../utils/alert';
import { generateVideoThumbnailUri } from '../utils/videoThumbnail';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

const VIDEO_POLL_INTERVAL_MS = 3000;
const VIDEO_POLL_MAX_ATTEMPTS = 40; // ~2 minutes
const REFRESH_SPINNER_COLOR = colors.textSecondary;

export function FeedScreen({ navigation }: Props) {
  const {
    currentUser,
    posts,
    users,
    toggleLike,
    addPost,
    removePost,
    signOut,
    feedRefreshing,
    feedLoadingMore,
    feedHasMore,
    refreshFeed,
    refreshPost,
    loadMoreFeed,
    unreadCount,
  } = useApp();
  const { strings } = useAuthLanguage();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [pickedMedia, setPickedMedia] = useState<PickedMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-280)).current;
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const { headerOffset, headerHeight, onHeaderLayout, onScroll } = useCollapsingHeader();

  const handleRefresh = useCallback(() => {
    void refreshFeed();
  }, [refreshFeed]);

  const canAddMore = pickedMedia.length === 0;

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
    setPickedMedia([]);
    setUploadProgress(null);
    setSubmitError(null);
  }, []);

  const pickMedia = useCallback(
    async (kind: 'image' | 'video') => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      if (pickedMedia.length > 0) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === 'video' ? ['videos'] : ['images'],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      let thumbnailUri: string | undefined;
      if (kind === 'video') {
        thumbnailUri = (await generateVideoThumbnailUri(asset.uri)) ?? undefined;
      }

      setPickedMedia([
        { uri: asset.uri, kind, width: asset.width, height: asset.height, thumbnailUri },
      ]);
    },
    [pickedMedia],
  );

  const handleAddPhoto = useCallback(() => pickMedia('image'), [pickMedia]);
  const handleAddVideo = useCallback(() => pickMedia('video'), [pickMedia]);

  const removeMedia = useCallback((index: number) => {
    setPickedMedia((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** Uploads all picked media with a concurrency of 3, reporting aggregate progress. */
  const uploadAll = useCallback(
    async (items: PickedMedia[]): Promise<UploadedMedia[] | null> => {
      const progress = new Array(items.length).fill(0);
      const report = () =>
        setUploadProgress(progress.reduce((a, b) => a + b, 0) / items.length);
      const results: (UploadedMedia | null)[] = new Array(items.length).fill(null);
      let cursor = 0;

      const worker = async () => {
        for (;;) {
          const i = cursor;
          cursor += 1;
          if (i >= items.length) return;
          const item = items[i];
          const onProgress = (f: number) => {
            progress[i] = f;
            report();
          };
          results[i] =
            item.kind === 'video'
              ? await uploadVideo(item.uri, onProgress)
              : await uploadImage(item.uri, onProgress, item.width, item.height);
          progress[i] = 1;
          report();
        }
      };

      await Promise.all([worker(), worker(), worker()]);
      return results.some((r) => r === null) ? null : (results as UploadedMedia[]);
    },
    [],
  );

  /** After a video post, poll until Stream finishes transcoding, then refresh that post. */
  const pollVideos = useCallback(
    (uploaded: UploadedMedia[], postId: string) => {
      const videos = uploaded.filter((u) => u.type === 'video');
      if (videos.length === 0) return;
      let attempts = 0;
      const tick = async () => {
        attempts += 1;
        const statuses = await Promise.all(videos.map((v) => getMediaStatus(v.mediaAssetId)));
        if (statuses.every((s) => s?.processingStatus === 'ready')) {
          await refreshPost(postId);
          return;
        }
        if (attempts < VIDEO_POLL_MAX_ATTEMPTS) setTimeout(tick, VIDEO_POLL_INTERVAL_MS);
      };
      setTimeout(tick, VIDEO_POLL_INTERVAL_MS);
    },
    [refreshPost],
  );

  // Keep the uploader's pending video posts in sync without a full page reload.
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      const pendingIds = postsRef.current
        .filter(
          (post) =>
            post.authorId === currentUser.id &&
            post.media?.some(
              (media) => media.type === 'video' && media.processingStatus === 'pending',
            ),
        )
        .map((post) => post.id);
      if (pendingIds.length === 0) return;
      void Promise.all(pendingIds.map((id) => refreshPost(id)));
    }, VIDEO_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [currentUser, refreshPost]);

  const handleSubmitPost = useCallback(async () => {
    if ((!composerText.trim() && pickedMedia.length === 0) || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    let uploaded: UploadedMedia[] = [];
    if (pickedMedia.length > 0) {
      setUploadProgress(0);
      const result = await uploadAll(pickedMedia);
      if (!result) {
        setSubmitting(false);
        setUploadProgress(null);
        const message = 'Your photo could not be uploaded. Please try again.';
        setSubmitError(message);
        showAlert('Upload failed', message);
        return;
      }
      uploaded = result;
    }

    const result = await addPost({ text: composerText, media: uploaded });
    setSubmitting(false);
    setUploadProgress(null);

    if (result.ok && result.postId) {
      pollVideos(uploaded, result.postId);
      closeComposer();
    } else {
      const message = 'Your post could not be published. Please try again.';
      setSubmitError(message);
      showAlert('Post failed', message);
    }
  }, [addPost, closeComposer, composerText, pickedMedia, pollVideos, submitting, uploadAll]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const handleComment = useCallback(
    (postId: string) => navigation.navigate('CommentThread', { postId }),
    [navigation],
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      const result = await removePost(postId);
      if (!result.ok) {
        showAlert('Delete failed', 'Could not delete this post. Please try again.');
      }
    },
    [removePost],
  );

  const renderItem = useCallback(
    ({ item }: { item: Post }) => {
      const author = users[item.authorId];
      if (!author) return null;
      return (
        <FeedPost
          post={item}
          author={author}
          currentUserId={currentUser?.id}
          isVideoActive={item.id === activeVideoId}
          onLike={toggleLike}
          onComment={handleComment}
          onDelete={handleDeletePost}
        />
      );
    },
    [activeVideoId, currentUser?.id, handleComment, handleDeletePost, toggleLike, users],
  );

  const keyExtractor = useCallback((item: Post) => item.id, []);

  // Autoplay the top-most video that is meaningfully on screen (X-style).
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: Post }> }) => {
      const withVideo = viewableItems.find(({ item }) =>
        item.media?.some((m) => m.type === 'video'),
      );
      setActiveVideoId(withVideo ? withVideo.item.id : null);
    },
  ).current;

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

  const renderListHeader = useCallback(() => {
    if (headerHeight === 0) return null;
    return <View style={{ height: headerHeight }} />;
  }, [headerHeight]);

  if (!currentUser) return null;

  return (
    <View style={styles.container}>
      <View style={styles.inner}>
        <FlatList
          data={posts}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={posts.length === 0 ? styles.listEmpty : styles.list}
          showsVerticalScrollIndicator={false}
          {...(Platform.OS === 'web'
            ? { refreshing: feedRefreshing, onRefresh: handleRefresh }
            : {})}
          refreshControl={
            Platform.OS === 'web' ? undefined : (
              <RefreshControl
                refreshing={feedRefreshing}
                onRefresh={handleRefresh}
                tintColor={REFRESH_SPINNER_COLOR}
                colors={[REFRESH_SPINNER_COLOR]}
                progressViewOffset={headerHeight}
              />
            )
          }
          onScroll={onScroll}
          scrollEventThrottle={16}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={handleViewableItemsChanged}
          onEndReached={feedHasMore ? loadMoreFeed : undefined}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={renderListHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={11}
          removeClippedSubviews
        />
        <Animated.View
          style={[styles.headerOverlay, { transform: [{ translateY: headerOffset }] }]}
          onLayout={onHeaderLayout}
        >
          <FeedHeader
            user={currentUser}
            unreadCount={unreadCount}
            onAvatarPress={openDrawer}
            onNotificationsPress={() => navigation.navigate('Notifications')}
          />
        </Animated.View>
        {feedRefreshing ? (
          <View
            pointerEvents="none"
            style={[styles.refreshOverlay, { top: Math.max(headerHeight - 28, 0) }]}
          >
            <ActivityIndicator size="small" color={REFRESH_SPINNER_COLOR} />
          </View>
        ) : null}
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
        media={pickedMedia}
        submitting={submitting}
        uploadProgress={uploadProgress}
        submitError={submitError}
        canAddMore={canAddMore}
        onChangeText={setComposerText}
        onAddPhoto={handleAddPhoto}
        onAddVideo={handleAddVideo}
        onRemoveMedia={removeMedia}
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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  refreshOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 11,
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
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
