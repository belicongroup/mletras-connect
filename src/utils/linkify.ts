export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;

function stripTrailingPunctuation(url: string): { href: string; suffix: string } {
  const match = url.match(/^(.+?)([.,!?;:)\]]*)$/);
  if (!match) return { href: url, suffix: '' };
  return { href: match[1], suffix: match[2] ?? '' };
}

/** Splits post text into plain text and URL segments for rendering. */
export function linkifyText(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    const { href, suffix } = stripTrailingPunctuation(raw);
    segments.push({ type: 'link', value: href });
    if (suffix) {
      segments.push({ type: 'text', value: suffix });
    }
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}
