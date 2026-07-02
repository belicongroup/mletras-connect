import { Comment } from '../types';

const mockComments: Comment[] = [
  {
    id: 'comment-1',
    postId: 'post-1',
    authorId: 'user-2',
    text: 'Te la mando por mensaje, la tengo en re fa#m.',
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'comment-2',
    postId: 'post-2',
    authorId: 'user-3',
    text: 'Se escuchó brutal. ¿Qué cuerdas usas en el bajo sexto?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

export async function getCommentsByPostId(postId: string): Promise<Comment[]> {
  return mockComments.filter((c) => c.postId === postId);
}
