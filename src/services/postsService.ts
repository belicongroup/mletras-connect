import { API_URL } from '../config/api';
import { Post, UserProfile } from '../types';
import { getToken } from './profileService';

interface ApiPost extends Post {
  author: UserProfile;
}

export interface FeedPage {
  posts: Post[];
  authors: UserProfile[];
  nextCursor: string | null;
}

export interface UploadedMedia {
  key: string;
  url: string;
  type: 'image';
}

interface RequestResult<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  headers: Record<string, string> = {},
): Promise<RequestResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(await authHeaders(headers)),
      },
    });
    const body = (await response.json().catch(() => null)) as
      | ({ ok?: boolean; error?: string } & T)
      | null;

    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? 'unknown' };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: 'networkError' };
  }
}

function splitFeed(apiPosts: ApiPost[]): { posts: Post[]; authors: UserProfile[] } {
  const posts: Post[] = [];
  const authors: UserProfile[] = [];
  for (const item of apiPosts) {
    const { author, ...post } = item;
    posts.push(post);
    if (author) authors.push(author);
  }
  return { posts, authors };
}

export async function getFeed(cursor?: string | null, limit = 20): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const result = await requestJson<{ posts: ApiPost[]; nextCursor: string | null }>(
    `/posts/feed?${params.toString()}`,
    { method: 'GET' },
  );

  if (!result.ok || !result.data) {
    return { posts: [], authors: [], nextCursor: null };
  }

  const { posts, authors } = splitFeed(result.data.posts);
  return { posts, authors, nextCursor: result.data.nextCursor };
}

export async function getMyPosts(cursor?: string | null, limit = 20): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const result = await requestJson<{ posts: ApiPost[]; nextCursor: string | null }>(
    `/posts/mine?${params.toString()}`,
    { method: 'GET' },
  );

  if (!result.ok || !result.data) {
    return { posts: [], authors: [], nextCursor: null };
  }

  const { posts, authors } = splitFeed(result.data.posts);
  return { posts, authors, nextCursor: result.data.nextCursor };
}

export async function createPost(input: {
  text: string;
  media?: UploadedMedia[];
}): Promise<{ post: Post; author: UserProfile } | null> {
  const result = await requestJson<{ post: ApiPost }>('/posts', {
    method: 'POST',
    body: JSON.stringify({ text: input.text, media: input.media ?? [] }),
  });

  if (!result.ok || !result.data) return null;
  const { author, ...post } = result.data.post;
  return { post, author };
}

export async function deletePost(postId: string): Promise<boolean> {
  const result = await requestJson(`/posts/${postId}`, { method: 'DELETE' });
  return result.ok;
}

export async function likePost(
  postId: string,
): Promise<{ likesCount: number; isLiked: boolean } | null> {
  const result = await requestJson<{ likesCount: number; isLiked: boolean }>(
    `/posts/${postId}/like`,
    { method: 'POST' },
  );
  return result.ok && result.data ? result.data : null;
}

export async function unlikePost(
  postId: string,
): Promise<{ likesCount: number; isLiked: boolean } | null> {
  const result = await requestJson<{ likesCount: number; isLiked: boolean }>(
    `/posts/${postId}/like`,
    { method: 'DELETE' },
  );
  return result.ok && result.data ? result.data : null;
}

export async function uploadImage(uri: string, mimeType: string): Promise<UploadedMedia | null> {
  try {
    const fileResponse = await fetch(uri);
    const blob = await fileResponse.blob();
    const contentType = mimeType || blob.type || 'image/jpeg';

    const response = await fetch(`${API_URL}/media/upload`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': contentType }),
      body: blob,
    });

    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; key?: string; url?: string; type?: string }
      | null;

    if (!response.ok || !body?.ok || !body.key || !body.url) {
      return null;
    }
    return { key: body.key, url: body.url, type: 'image' };
  } catch {
    return null;
  }
}
