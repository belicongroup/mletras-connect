import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LinkedPostText } from '../components/LinkedPostText';
import { ScreenHeader } from '../components/ScreenHeader';
import { SocialLinkEmbed } from '../components/SocialLinkEmbed';
import { useApp } from '../context/AppContext';
import { useAuthLanguage } from '../context/AuthLanguageContext';
import { createComment, deleteComment, getComments } from '../services/commentsService';
import { getPost } from '../services/postsService';
import { Comment, Post, RootStackParamList, UserProfile } from '../types';
import { colors, spacing, typography } from '../theme';
import { formatRelativeTime, getLocation } from '../utils/format';
import { extractSocialLinks } from '../utils/socialLinks';
import { showAlert } from '../utils/alert';

type Props = NativeStackScreenProps<RootStackParamList, 'CommentThread'>;

interface FlatComment {
  comment: Comment;
  isReply: boolean;
}

function flatten(comments: Comment[]): FlatComment[] {
  const out: FlatComment[] = [];
  for (const comment of comments) {
    out.push({ comment, isReply: false });
    for (const reply of comment.replies ?? []) {
      out.push({ comment: reply, isReply: true });
    }
  }
  return out;
}

function CommentRow({
  comment,
  isReply,
  postId,
  currentUserId,
  onDelete,
}: FlatComment & {
  postId: string;
  currentUserId?: string;
  onDelete: (commentId: string) => void;
}) {
  const { strings } = useAuthLanguage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isOwner = currentUserId === comment.authorId;

  const handleDelete = () => {
    setDeleteOpen(false);
    onDelete(comment.id);
  };

  return (
    <View style={[styles.commentRow, isReply && styles.replyRow]}>
      <Avatar user={comment.author} size={isReply ? 28 : 36} />
      <View style={styles.commentBody}>
        <View style={styles.commentHeaderRow}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentUser}>@{comment.author.username}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.commentMeta}>{formatRelativeTime(comment.createdAt)}</Text>
          </View>
          {isOwner ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Comment options"
                onPress={() => setDeleteOpen(true)}
                hitSlop={8}
                style={({ pressed }) => [styles.menuTrigger, pressed && styles.pressed]}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
              </Pressable>
              <ConfirmDialog
                visible={deleteOpen}
                title={strings.deleteCommentConfirm}
                confirmLabel={strings.deleteComment}
                cancelLabel={strings.cancel}
                destructive
                onConfirm={handleDelete}
                onCancel={() => setDeleteOpen(false)}
              />
            </>
          ) : null}
        </View>
        <LinkedPostText text={comment.text} style={styles.commentText} />
      </View>
    </View>
  );
}

export function CommentThreadScreen({ route, navigation }: Props) {
  const { postId } = route.params;
  const insets = useSafeAreaInsets();
  const { strings } = useAuthLanguage();
  const { incrementCommentCount, currentUser, removePost } = useApp();

  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<UserProfile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [deletePostOpen, setDeletePostOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [postResult, page] = await Promise.all([getPost(postId), getComments(postId, null)]);
      if (!mounted) return;
      if (postResult) {
        setPost(postResult.post);
        setAuthor(postResult.author);
      }
      setComments(page.comments);
      setCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [postId]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const page = await getComments(postId, cursor);
    setComments((prev) => {
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...page.comments.filter((c) => !seen.has(c.id))];
    });
    setCursor(page.nextCursor);
    setHasMore(page.nextCursor !== null);
  }, [cursor, postId]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    const created = await createComment(postId, text);
    setSending(false);

    if (created) {
      setComments((prev) => [...prev, created]);
      setDraft('');
      setPost((prev) =>
        prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev,
      );
      incrementCommentCount(postId);
    }
  }, [draft, incrementCommentCount, postId, sending]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      const removed = await deleteComment(postId, commentId);
      if (removed === null) {
        showAlert('Delete failed', 'Could not delete this comment. Please try again.');
        return;
      }
      setComments((prev) =>
        prev
          .filter((c) => c.id !== commentId)
          .map((c) => ({
            ...c,
            replies: (c.replies ?? []).filter((r) => r.id !== commentId),
          })),
      );
      setPost((prev) =>
        prev
          ? { ...prev, commentsCount: Math.max(prev.commentsCount - removed, 0) }
          : prev,
      );
    },
    [postId],
  );

  const handleDeletePost = useCallback(async () => {
    setDeletePostOpen(false);
    const result = await removePost(postId);
    if (result.ok) {
      navigation.goBack();
    } else {
      showAlert('Delete failed', 'Could not delete this post. Please try again.');
    }
  }, [navigation, postId, removePost]);

  const data = flatten(comments);

  const postSocialLink = useMemo(() => {
    if (!post?.text) return null;
    const hasNativeMedia = Boolean(
      post.imageUrl || post.media?.some((m) => m.type === 'image' || m.type === 'video'),
    );
    if (hasNativeMedia) return null;
    return extractSocialLinks(post.text)[0] ?? null;
  }, [post]);

  const renderHeader = useCallback(() => {
    if (!post || !author) return null;
    const isOwner = currentUser?.id === post.authorId;
    return (
      <View style={styles.postCard}>
        <View style={styles.postRow}>
          <Avatar user={author} size={40} />
          <View style={styles.postContent}>
            <View style={styles.commentHeaderRow}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentUser}>@{author.username}</Text>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.commentMeta}>{formatRelativeTime(post.createdAt)}</Text>
              </View>
              {isOwner ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Post options"
                    onPress={() => setDeletePostOpen(true)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.menuTrigger, pressed && styles.pressed]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <ConfirmDialog
                    visible={deletePostOpen}
                    title={strings.deletePostConfirm}
                    confirmLabel={strings.deletePost}
                    cancelLabel={strings.cancel}
                    destructive
                    onConfirm={handleDeletePost}
                    onCancel={() => setDeletePostOpen(false)}
                  />
                </>
              ) : null}
            </View>
            <Text style={styles.location}>{getLocation(author.city, author.state)}</Text>
            {post.text ? <LinkedPostText text={post.text} style={styles.postText} /> : null}
            {postSocialLink ? <SocialLinkEmbed link={postSocialLink} /> : null}
            {post.imageUrl ? (
              <Image style={styles.media} source={{ uri: post.imageUrl }} contentFit="cover" />
            ) : null}
          </View>
        </View>
        <Text style={styles.commentsTitle}>{strings.comments}</Text>
      </View>
    );
  }, [author, currentUser?.id, deletePostOpen, handleDeletePost, post, postSocialLink, strings]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <ScreenHeader title={strings.comments} onBack={() => navigation.goBack()} />

      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.comment.id}
          renderItem={({ item }) => (
            <CommentRow
              {...item}
              postId={postId}
              currentUserId={currentUser?.id}
              onDelete={handleDeleteComment}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={<Text style={styles.empty}>{strings.noCommentsYet}</Text>}
          contentContainerStyle={styles.list}
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          placeholder={strings.commentPlaceholder}
          placeholderTextColor={colors.textSecondary}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={strings.send}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    padding: spacing.xxl,
  },
  list: {
    paddingBottom: spacing.lg,
  },
  postCard: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  postRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  postContent: {
    flex: 1,
  },
  location: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  postText: {
    ...typography.body,
    color: colors.text,
  },
  media: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 16,
    marginTop: spacing.md,
    backgroundColor: colors.placeholder,
  },
  commentsTitle: {
    ...typography.bodyBold,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  replyRow: {
    paddingLeft: spacing.xxl + spacing.lg,
  },
  commentBody: {
    flex: 1,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  menuTrigger: {
    padding: spacing.xs,
    marginLeft: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  commentHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  commentUser: {
    ...typography.bodyBold,
    color: colors.text,
  },
  dot: {
    color: colors.textSecondary,
    marginHorizontal: 4,
  },
  commentMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  commentText: {
    ...typography.body,
    color: colors.text,
    marginTop: 2,
  },
  empty: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.xxl,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    maxHeight: 120,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.drawer,
    borderRadius: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
