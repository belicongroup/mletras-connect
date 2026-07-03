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

export interface Post {
  id: string;
  authorId: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
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
};
