export type Instrument =
  | 'Accordion'
  | 'Bajo Quinto'
  | 'Bajo Sexto'
  | 'Bass'
  | 'Drums'
  | 'Guitar'
  | 'Tololoche'
  | 'Keyboard'
  | 'Saxophone'
  | 'Trumpet'
  | 'Trombone'
  | 'Tuba'
  | 'Vocals'
  | 'Percussion'
  | 'Other';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  country: string;
  city: string;
  state: string;
  instruments: Instrument[];
  createdAt: string;
}

export interface ImageVariantUrls {
  thumb: string;
  small: string;
  medium: string;
  large: string;
  original: string;
}

export type MediaProcessingStatus = 'ready' | 'pending' | 'failed';

export interface PostMedia {
  type: 'image' | 'video';
  /** Default URL: medium image variant, or HLS manifest for video. */
  url: string;
  width?: number;
  height?: number;
  /** Tiny base64 placeholder for progressive loading. */
  lqip?: string;
  processingStatus: MediaProcessingStatus;
  /** Responsive image variants; pick by screen size + network. */
  variants?: ImageVariantUrls;
  hlsUrl?: string;
  posterUrl?: string;
  durationMs?: number;
}

export interface Post {
  id: string;
  authorId: string;
  text: string;
  /** Retained for backward compatibility: first image's medium variant. */
  imageUrl?: string;
  media?: PostMedia[];
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  text: string;
  createdAt: string;
  author: UserProfile;
  replies?: Comment[];
}

export type NotificationType = 'comment_on_post' | 'reply_in_thread';

export interface NotificationActor {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  read: boolean;
  createdAt: string;
  actor: NotificationActor;
  postPreview?: string;
}

export type RootStackParamList = {
  Auth: undefined;
  SignUpEmail: undefined;
  ForgotPassword: undefined;
  OtpVerification: { email: string; flow?: 'signup' | 'reset' };
  CreatePassword: { email: string; flow?: 'signup' | 'reset' };
  ProfileSetup: { email: string; password?: string };
  Feed: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
  CommentThread: { postId: string };
};
