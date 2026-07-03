import { Comment } from '../types';
import { apiRequest } from './apiClient';

export interface CommentsPage {
  comments: Comment[];
  nextCursor: string | null;
}

export async function getComments(
  postId: string,
  cursor?: string | null,
  limit = 20,
): Promise<CommentsPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);

  const result = await apiRequest<{ comments: Comment[]; nextCursor: string | null }>(
    `/posts/${postId}/comments?${params.toString()}`,
    { method: 'GET' },
  );

  if (!result.ok || !result.data) {
    return { comments: [], nextCursor: null };
  }
  return { comments: result.data.comments, nextCursor: result.data.nextCursor };
}

export async function createComment(
  postId: string,
  text: string,
  parentId?: string,
): Promise<Comment | null> {
  const result = await apiRequest<{ comment: Comment }>(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, parentId }),
  });

  return result.ok && result.data ? result.data.comment : null;
}

export async function deleteComment(postId: string, commentId: string): Promise<number | null> {
  const result = await apiRequest<{ removed?: number }>(
    `/posts/${postId}/comments/${commentId}`,
    { method: 'DELETE' },
  );
  return result.ok && result.data?.removed != null ? result.data.removed : null;
}
