export type SocialPlatform = 'tiktok' | 'instagram' | 'facebook';

export interface SocialLink {
  platform: SocialPlatform;
  /** Normalized share URL. */
  url: string;
  /** iframe src when inline playback is supported. */
  embedUrl?: string;
  embedHeight: number;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[.,!?;:)\]]+$/, '');
}

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of matches) {
    const cleaned = stripTrailingPunctuation(match);
    if (!seen.has(cleaned)) {
      seen.add(cleaned);
      urls.push(cleaned);
    }
  }
  return urls;
}

export function parseSocialLink(rawUrl: string): SocialLink | null {
  try {
    const url = new URL(stripTrailingPunctuation(rawUrl));
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'tiktok.com') {
      const videoMatch = url.pathname.match(/\/video\/(\d+)/);
      if (videoMatch) {
        const canonical = `https://www.tiktok.com${url.pathname}`;
        return {
          platform: 'tiktok',
          url: canonical,
          embedUrl: `https://www.tiktok.com/embed/v2/${videoMatch[1]}`,
          embedHeight: 575,
        };
      }
      return { platform: 'tiktok', url: url.toString(), embedHeight: 0 };
    }

    if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
      return { platform: 'tiktok', url: url.toString(), embedHeight: 0 };
    }

    if (host === 'instagram.com') {
      const match = url.pathname.match(/\/(reel|p|tv)\/([A-Za-z0-9_-]+)/);
      if (match) {
        const canonical = `https://www.instagram.com/${match[1]}/${match[2]}/`;
        return {
          platform: 'instagram',
          url: canonical,
          embedUrl: `https://www.instagram.com/${match[1]}/${match[2]}/embed`,
          embedHeight: 520,
        };
      }
    }

    if (host === 'facebook.com' || host === 'fb.watch') {
      const canonical = url.toString();
      return {
        platform: 'facebook',
        url: canonical,
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(canonical)}&show_text=false&width=560`,
        embedHeight: 476,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function extractSocialLinks(text: string): SocialLink[] {
  return extractUrls(text)
    .map(parseSocialLink)
    .filter((link): link is SocialLink => link !== null);
}
