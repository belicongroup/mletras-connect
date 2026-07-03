import { requireAuth } from '../lib/auth';
import { corsHeaders, errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function publicUrl(request: Request, key: string): string {
  return `${new URL(request.url).origin}/media/${key}`;
}

export async function handleMediaRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  // Public read: GET /media/<key>
  if (path.startsWith('/media/') && request.method === 'GET') {
    const key = decodeURIComponent(path.slice('/media/'.length));
    if (!key) return errorResponse(request, 'notFound', 404);

    const object = await env.MEDIA.get(key);
    if (!object) return errorResponse(request, 'notFound', 404);

    const headers = new Headers(corsHeaders(request) as HeadersInit);
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  }

  // Authenticated upload: POST /media/upload
  if (path === '/media/upload' && request.method === 'POST') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const contentType = (request.headers.get('Content-Type') ?? '').split(';')[0].trim();
    const ext = MIME_EXT[contentType];
    if (!ext) {
      return errorResponse(request, 'unsupportedMediaType', 415);
    }

    const declaredLength = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10);
    if (declaredLength && declaredLength > MAX_BYTES) {
      return errorResponse(request, 'fileTooLarge', 413);
    }

    const buffer = await request.arrayBuffer();
    if (buffer.byteLength === 0) {
      return errorResponse(request, 'invalidRequest');
    }
    if (buffer.byteLength > MAX_BYTES) {
      return errorResponse(request, 'fileTooLarge', 413);
    }

    const key = `posts/${auth.payload.sub}/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA.put(key, buffer, {
      httpMetadata: { contentType },
    });

    return jsonResponse(request, {
      ok: true,
      key,
      url: publicUrl(request, key),
      type: 'image',
    });
  }

  return null;
}
