import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { addPost as addPostService, getPosts, setPostsStore } from '../services/postsService';
import { clearSession, getSession, saveSession } from '../services/profileService';
import {
  createUser,
  getUserById,
  getUserByUsername,
  getUsers,
  updateUser,
} from '../services/usersService';
import { Instrument, Post, UserProfile } from '../types';

interface SignUpInput {
  username: string;
  email?: string;
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
  signIn: (username: string) => Promise<{ ok: boolean; error?: string }>;
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

      if (session) {
        const user = usersMap[session.userId];
        if (user) {
          setCurrentUser(user);
          setHasCompletedProfile(session.hasCompletedProfile);
        }
      }

      setIsLoading(false);
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (username: string) => {
    const user = await getUserByUsername(username);
    if (!user) {
      return { ok: false, error: 'accountNotFound' };
    }

    setCurrentUser(user);
    setHasCompletedProfile(true);
    setUsers((prev) => ({ ...prev, [user.id]: user }));
    await saveSession({ userId: user.id, hasCompletedProfile: true });
    return { ok: true };
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const existing = await getUserByUsername(input.username);
    if (existing) {
      return { ok: false, error: 'usernameTaken' };
    }

    const user = await createUser({
      username: input.username.trim(),
      email: input.email?.trim() || undefined,
      firstName: input.firstName?.trim() || undefined,
      lastName: input.lastName?.trim() || undefined,
      country: input.country.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      instruments: input.instruments,
    });

    setCurrentUser(user);
    setHasCompletedProfile(true);
    setUsers((prev) => ({ ...prev, [user.id]: user }));
    await saveSession({ userId: user.id, hasCompletedProfile: true });
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
        await saveSession({ userId: updated.id, hasCompletedProfile: true });
      }
    },
    [currentUser],
  );

  const signOut = useCallback(async () => {
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
