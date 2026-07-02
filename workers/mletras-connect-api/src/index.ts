import type { Env } from './routes/auth';
import { handleAuthRequest } from './routes/auth';
import { errorResponse, handleOptions, jsonResponse } from './lib/cors';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const options = handleOptions(request);
    if (options) return options;

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === '/health' && request.method === 'GET') {
      return jsonResponse(request, { ok: true, service: 'mletras-connect-api' });
    }

    if (path.startsWith('/auth')) {
      const authResponse = await handleAuthRequest(request, env, path);
      if (authResponse) return authResponse;
    }

    return errorResponse(request, 'notFound', 404);
  },
};

export type { Env };
