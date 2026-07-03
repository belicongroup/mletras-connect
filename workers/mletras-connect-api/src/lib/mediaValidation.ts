/**
 * Server-side media validation. Runs inside the Worker with no native deps.
 *
 * Security posture:
 * - Never trust the client-declared Content-Type. Sniff magic bytes instead and
 *   derive the canonical MIME + extension from the actual file signature.
 * - Parse intrinsic dimensions from the container header (no full decode) so we
 *   can reject decompression bombs before anything expensive touches the bytes.
 */

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_IMAGE_DIMENSION = 8192; // reject inputs whose longest edge exceeds this

export interface SniffedImage {
  mime: string;
  ext: string;
  /** Whether Cloudflare Images / the client must transcode before display (HEIC). */
  needsTranscode: boolean;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/** Allowed still-image inputs. HEIC/HEIF are accepted but flagged for transcode. */
const IMAGE_SIGNATURES: Array<{
  mime: string;
  ext: string;
  needsTranscode: boolean;
  match: (bytes: Uint8Array) => boolean;
}> = [
  {
    mime: 'image/jpeg',
    ext: 'jpg',
    needsTranscode: false,
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: 'png',
    needsTranscode: false,
    match: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    ext: 'webp',
    needsTranscode: false,
    match: (b) =>
      b[0] === 0x52 && // R
      b[1] === 0x49 && // I
      b[2] === 0x46 && // F
      b[3] === 0x46 && // F
      b[8] === 0x57 && // W
      b[9] === 0x45 && // E
      b[10] === 0x42 && // B
      b[11] === 0x50, // P
  },
  {
    mime: 'image/gif',
    ext: 'gif',
    needsTranscode: false,
    match: (b) =>
      b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38, // GIF8
  },
  {
    mime: 'image/heic',
    ext: 'heic',
    needsTranscode: true,
    match: (b) => isHeif(b),
  },
];

/** HEIF family: `....ftyp<brand>` where brand is one of the HEIC/HEIF codes. */
function isHeif(b: Uint8Array): boolean {
  if (b[4] !== 0x66 || b[5] !== 0x74 || b[6] !== 0x79 || b[7] !== 0x70) return false; // "ftyp"
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'mif1', 'msf1'].includes(brand);
}

/** SHA-256 hex digest, used as a content fingerprint for deduplication. */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Returns the canonical image type from magic bytes, or null when unrecognized. */
export function sniffImage(buffer: ArrayBuffer): SniffedImage | null {
  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes.length < 12) return null;
  for (const sig of IMAGE_SIGNATURES) {
    if (sig.match(bytes)) {
      return { mime: sig.mime, ext: sig.ext, needsTranscode: sig.needsTranscode };
    }
  }
  return null;
}

/**
 * Extracts intrinsic pixel dimensions from the container header without a full
 * decode. Returns null for formats we cannot cheaply parse (e.g. HEIC), in which
 * case dimension enforcement is delegated to the downstream processor.
 */
export function readImageDimensions(mime: string, buffer: ArrayBuffer): ImageDimensions | null {
  const bytes = new Uint8Array(buffer);
  switch (mime) {
    case 'image/png':
      return readPngDimensions(bytes);
    case 'image/jpeg':
      return readJpegDimensions(bytes);
    case 'image/gif':
      return readGifDimensions(bytes);
    case 'image/webp':
      return readWebpDimensions(bytes);
    default:
      return null;
  }
}

function readPngDimensions(b: Uint8Array): ImageDimensions | null {
  if (b.length < 24) return null;
  const view = new DataView(b.buffer, b.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readGifDimensions(b: Uint8Array): ImageDimensions | null {
  if (b.length < 10) return null;
  const view = new DataView(b.buffer, b.byteOffset);
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readJpegDimensions(b: Uint8Array): ImageDimensions | null {
  let offset = 2; // skip SOI
  const view = new DataView(b.buffer, b.byteOffset);
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry frame dimensions.
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      const height = view.getUint16(offset + 5);
      const width = view.getUint16(offset + 7);
      return { width, height };
    }
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebpDimensions(b: Uint8Array): ImageDimensions | null {
  if (b.length < 30) return null;
  const format = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (format === 'VP8 ') {
    // Lossy: 16-bit LE width/height at offset 26, masked to 14 bits.
    const width = (b[26] | (b[27] << 8)) & 0x3fff;
    const height = (b[28] | (b[29] << 8)) & 0x3fff;
    return { width, height };
  }
  if (format === 'VP8L') {
    // Lossless: 14-bit dimensions packed after the 0x2f signature byte.
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (format === 'VP8X') {
    // Extended: 24-bit LE dimensions minus one at offset 24/27.
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width, height };
  }
  return null;
}
