import { Platform } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';

/** Returns a local image URI (or data URL on web) for a video preview frame. */
export async function generateVideoThumbnailUri(videoUri: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return generateWebVideoThumbnail(videoUri);
  }

  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 0,
      quality: 0.8,
    });
    return uri;
  } catch {
    return null;
  }
}

function generateWebVideoThumbnail(videoUri: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const timeout = setTimeout(() => cleanup(null), 10_000);

    const cleanup = (result: string | null) => {
      clearTimeout(timeout);
      video.pause();
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };

    const capture = () => {
      try {
        const width = video.videoWidth;
        const height = video.videoHeight;
        if (!width || !height) {
          cleanup(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        cleanup(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        cleanup(null);
      }
    };

    video.onerror = () => cleanup(null);
    video.onloadeddata = () => {
      if (video.currentTime < 0.01) {
        video.currentTime = Math.min(0.1, (video.duration || 1) * 0.05);
        return;
      }
      capture();
    };
    video.onseeked = () => capture();

    video.src = videoUri;
    video.load();
  });
}
