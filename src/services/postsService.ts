import { Post } from '../types';

const mockPosts: Post[] = [
  {
    id: 'post-1',
    authorId: 'user-1',
    text: '¿Alguien tiene la armonía del intro de "Mi Último Deseo"? Estoy preparándola para un evento en Monterrey este fin de semana.',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    likesCount: 24,
    commentsCount: 7,
    isLiked: false,
  },
  {
    id: 'post-2',
    authorId: 'user-2',
    text: 'Acabo de terminar un set de norteño con bajo sexto en vivo. Nada como el sonido crudo sin playback.',
    imageUrl: 'placeholder',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    likesCount: 89,
    commentsCount: 12,
    isLiked: true,
  },
  {
    id: 'post-3',
    authorId: 'user-3',
    text: 'Busco percusionista para grupo regional en LA. Repertorio clásico y algunas originales. DM si les interesa.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    likesCount: 41,
    commentsCount: 15,
    isLiked: false,
  },
  {
    id: 'post-4',
    authorId: 'user-1',
    text: 'Tip para acordeonistas: calienten el instrumento 15 minutos antes del show. La afinación cambia mucho con el frío.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    likesCount: 156,
    commentsCount: 23,
    isLiked: false,
  },
  {
    id: 'post-5',
    authorId: 'user-2',
    text: 'Primera vez tocando en un quinceañera con mariachi y norteño en el mismo evento. ¡Qué experiencia!',
    videoUrl: 'placeholder',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    likesCount: 67,
    commentsCount: 9,
    isLiked: false,
  },
];

let postsStore = [...mockPosts];

export async function getPosts(): Promise<Post[]> {
  return [...postsStore].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getPostsByUserId(userId: string): Promise<Post[]> {
  return postsStore
    .filter((p) => p.authorId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function addPost(
  post: Omit<Post, 'id' | 'createdAt' | 'likesCount' | 'commentsCount' | 'isLiked'>,
): Promise<Post> {
  const newPost: Post = {
    ...post,
    id: `post-${Date.now()}`,
    createdAt: new Date().toISOString(),
    likesCount: 0,
    commentsCount: 0,
    isLiked: false,
  };
  postsStore = [newPost, ...postsStore];
  return newPost;
}

export function setPostsStore(posts: Post[]): void {
  postsStore = posts;
}

export function resetPostsStore(): void {
  postsStore = [...mockPosts];
}
