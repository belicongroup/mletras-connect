import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as authService from '../services/authService';
import * as postsService from '../services/postsService';
import type { UploadedMedia } from '../services/postsService';
import { clearSession, getSession, saveSession } from '../services/profileService';
import { Instrument, Post, UserProfile } from '../types';

interface SignUpInput {
  username: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  country: string;
  city: string;
  state: string;
  instruments: Instrument[];
}

interface CreatePostInput {
  text: string;
  media?: UploadedMedia[];
}

interface AppContextValue {
  isLoading: boolean;
  currentUser: UserProfile | null;
  users: Record<string, UserProfile>;
  posts: Post[];
  feedRefreshing: boolean;
  feedLoadingMore: boolean;
  feedHasMore: boolean;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (input: SignUpInput) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<SignUpInput>) => Promise<{ ok: boolean; error?: string }>;
  addPost: (input: CreatePostInput) => Promise<{ ok: boolean; error?: string }>;
  toggleLike: (postId: string) => void;
  refreshFeed: () => Promise<void>;
  loadMoreFeed: () => Promise<void>;
  hasCompletedProfile: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);

  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [feedHasMore, setFeedHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  const mergeAuthors = useCallback((authors: UserProfile[]) => {
    if (authors.length === 0) return;
    setUsers((prev) => {
      const next = { ...prev };
      for (const author of authors) next[author.id] = author;
      return next;
    });
  }, []);

  const refreshFeed = useCallback(async () => {
    setFeedRefreshing(true);
    const page = await postsService.getFeed(null);
    cursorRef.current = page.nextCursor;
    setFeedHasMore(page.nextCursor !== null);
    mergeAuthors(page.authors);
    setPosts(page.posts);
    setFeedRefreshing(false);
  }, [mergeAuthors]);

  const loadMoreFeed = useCallback(async () => {
    if (loadingRef.current || !cursorRef.current) return;
    loadingRef.current = true;
    setFeedLoadingMore(true);

    const page = await postsService.getFeed(cursorRef.current);
    cursorRef.current = page.nextCursor;
    setFeedHasMore(page.nextCursor !== null);
    mergeAuthors(page.authors);
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const additions = page.posts.filter((p) => !seen.has(p.id));
      return [...prev, ...additions];
    });

    setFeedLoadingMore(false);
    loadingRef.current = false;
  }, [mergeAuthors]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const session = await getSession();
      if (!mounted) return;

      if (session?.token) {
        const me = await authService.getCurrentUser();
        if (!mounted) return;

        if (me.ok && me.data) {
          setCurrentUser(me.data);
          setHasCompletedProfile(session.hasCompletedProfile);
          setUsers({ [me.data.id]: me.data });
          await refreshFeed();
        } else {
          await clearSession();
        }
      }

      if (mounted) setIsLoading(false);
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [refreshFeed]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await authService.login(email.trim(), password);
      if (!result.ok || !result.data) {
        return { ok: false, error: result.error ?? 'invalidCredentials' };
      }

      setCurrentUser(result.data.user);
      setHasCompletedProfile(true);
      setUsers((prev) => ({ ...prev, [result.data!.user.id]: result.data!.user }));
      await saveSession({
        userId: result.data.user.id,
        token: result.data.token,
        hasCompletedProfile: true,
      });
      await refreshFeed();
      return { ok: true };
    },
    [refreshFeed],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      if (!input.email || !input.password) {
        return { ok: false, error: 'unknown' };
      }

      const result = await authService.signUp({
        email: input.email.trim(),
        password: input.password,
        username: input.username.trim(),
        firstName: input.firstName?.trim() || undefined,
        lastName: input.lastName?.trim() || undefined,
        country: input.country.trim(),
        state: input.state.trim(),
        city: input.city.trim(),
        instruments: input.instruments,
      });

      if (!result.ok || !result.data) {
        return { ok: false, error: result.error ?? 'unknown' };
      }

      setCurrentUser(result.data.user);
      setHasCompletedProfile(true);
      setUsers((prev) => ({ ...prev, [result.data!.user.id]: result.data!.user }));
      await saveSession({
        userId: result.data.user.id,
        token: result.data.token,
        hasCompletedProfile: true,
      });
      await refreshFeed();
      return { ok: true };
    },
    [refreshFeed],
  );

  const signOut = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
    setHasCompletedProfile(false);
    setUsers({});
    setPosts([]);
    cursorRef.current = null;
    setFeedHasMore(true);
    await clearSession();
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<SignUpInput>) => {
      if (!currentUser) return { ok: false, error: 'unknown' };

      const result = await authService.updateProfile({
        firstName: data.firstName?.trim() || undefined,
        lastName: data.lastName?.trim() || undefined,
        country: (data.country ?? currentUser.country).trim(),
        state: (data.state ?? currentUser.state).trim(),
        city: (data.city ?? currentUser.city).trim(),
        instruments: data.instruments ?? currentUser.instruments,
      });

      if (result.ok && result.data) {
        setCurrentUser(result.data);
        setUsers((prev) => ({ ...prev, [result.data!.id]: result.data! }));
        return { ok: true };
      }

      return { ok: false, error: result.error ?? 'unknown' };
    },
    [currentUser],
  );

  const addPost = useCallback(
    async (input: CreatePostInput) => {
      if (!currentUser) return { ok: false, error: 'unknown' };

      const created = await postsService.createPost({
        text: input.text.trim(),
        media: input.media,
      });

      if (!created) return { ok: false, error: 'unknown' };

      setUsers((prev) => ({ ...prev, [created.author.id]: created.author }));
      setPosts((prev) => [created.post, ...prev]);
      return { ok: true };
    },
    [currentUser],
  );

  const toggleLike = useCallback(
    (postId: string) => {
      const target = posts.find((p) => p.id === postId);
      if (!target) return;

      const nextLiked = !target.isLiked;

      // Optimistic update.
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: nextLiked,
                likesCount: post.likesCount + (nextLiked ? 1 : -1),
              }
            : post,
        ),
      );

      const action = nextLiked ? postsService.likePost : postsService.unlikePost;
      action(postId).then((result) => {
        if (!result) {
          // Roll back on failure.
          setPosts((prev) =>
            prev.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    isLiked: target.isLiked,
                    likesCount: target.likesCount,
                  }
                : post,
            ),
          );
          return;
        }
        // Reconcile with server truth.
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? { ...post, isLiked: result.isLiked, likesCount: result.likesCount }
              : post,
          ),
        );
      });
    },
    [posts],
  );

  const value = useMemo(
    () => ({
      isLoading,
      currentUser,
      users,
      posts,
      feedRefreshing,
      feedLoadingMore,
      feedHasMore,
      signIn,
      signUp,
      signOut,
      updateProfile,
      addPost,
      toggleLike,
      refreshFeed,
      loadMoreFeed,
      hasCompletedProfile,
    }),
    [
      isLoading,
      currentUser,
      users,
      posts,
      feedRefreshing,
      feedLoadingMore,
      feedHasMore,
      signIn,
      signUp,
      signOut,
      updateProfile,
      addPost,
      toggleLike,
      refreshFeed,
      loadMoreFeed,
      hasCompletedProfile,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
