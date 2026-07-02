import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as authService from '../services/authService';
import { addPost as addPostService, getPosts, setPostsStore } from '../services/postsService';
import { clearSession, getSession, saveSession } from '../services/profileService';
import {
  getUsers,
  updateUser,
} from '../services/usersService';
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
  imageUrl?: string;
  videoUrl?: string;
}

interface AppContextValue {
  isLoading: boolean;
  currentUser: UserProfile | null;
  users: Record<string, UserProfile>;
  posts: Post[];
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signUp: (input: SignUpInput) => Promise<{ ok: boolean; error?: string }>;
  completeProfileSetup: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<SignUpInput>) => Promise<void>;
  addPost: (input: CreatePostInput) => Promise<void>;
  toggleLike: (postId: string) => void;
  hasCompletedProfile: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasCompletedProfile, setHasCompletedProfile] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const [usersData, postsData, session] = await Promise.all([
        getUsers(),
        getPosts(),
        getSession(),
      ]);

      if (!mounted) return;

      const usersMap = Object.fromEntries(usersData.map((u) => [u.id, u]));
      setUsers(usersMap);
      setPosts(postsData);

      if (session?.token) {
        const me = await authService.getCurrentUser();
        if (me.ok && me.data) {
          setCurrentUser(me.data);
          setHasCompletedProfile(session.hasCompletedProfile);
          setUsers((prev) => ({ ...prev, [me.data!.id]: me.data! }));
        } else {
          await clearSession();
        }
      }

      setIsLoading(false);
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
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
    return { ok: true };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
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
    return { ok: true };
  }, []);

  const completeProfileSetup = useCallback(
    async (input: SignUpInput) => {
      if (!currentUser) return;

      const updated = await updateUser(currentUser.id, {
        username: input.username.trim(),
        firstName: input.firstName?.trim() || undefined,
        lastName: input.lastName?.trim() || undefined,
        country: input.country.trim(),
        city: input.city.trim(),
        state: input.state.trim(),
        instruments: input.instruments,
      });

      if (updated) {
        setCurrentUser(updated);
        setUsers((prev) => ({ ...prev, [updated.id]: updated }));
        setHasCompletedProfile(true);
        const session = await getSession();
        if (session) {
          await saveSession({ ...session, hasCompletedProfile: true });
        }
      }
    },
    [currentUser],
  );

  const signOut = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
    setHasCompletedProfile(false);
    await clearSession();
  }, []);

  const updateProfile = useCallback(
    async (data: Partial<SignUpInput>) => {
      if (!currentUser) return;

      const updated = await updateUser(currentUser.id, data);
      if (updated) {
        setCurrentUser(updated);
        setUsers((prev) => ({ ...prev, [updated.id]: updated }));
      }
    },
    [currentUser],
  );

  const addPost = useCallback(
    async (input: CreatePostInput) => {
      if (!currentUser) return;

      const newPost = await addPostService({
        authorId: currentUser.id,
        text: input.text.trim(),
        imageUrl: input.imageUrl,
        videoUrl: input.videoUrl,
      });

      setPosts((prev) => [newPost, ...prev]);
    },
    [currentUser],
  );

  const toggleLike = useCallback((postId: string) => {
    setPosts((prev) => {
      const next = prev.map((post) => {
        if (post.id !== postId) return post;
        const isLiked = !post.isLiked;
        return {
          ...post,
          isLiked,
          likesCount: post.likesCount + (isLiked ? 1 : -1),
        };
      });
      setPostsStore(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      currentUser,
      users,
      posts,
      signIn,
      signUp,
      completeProfileSetup,
      signOut,
      updateProfile,
      addPost,
      toggleLike,
      hasCompletedProfile,
    }),
    [
      isLoading,
      currentUser,
      users,
      posts,
      signIn,
      signUp,
      completeProfileSetup,
      signOut,
      updateProfile,
      addPost,
      toggleLike,
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
