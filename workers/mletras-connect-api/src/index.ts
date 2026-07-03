import type { Env } from './lib/env';
import { handleAuthRequest } from './routes/auth';
import { handleMediaRequest } from './routes/media';
import { handlePostsRequest } from './routes/posts';
import { handleUsersRequest } from './routes/users';
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

    if (path.startsWith('/users')) {
      const usersResponse = await handleUsersRequest(request, env, path);
      if (usersResponse) return usersResponse;
    }

    if (path.startsWith('/posts')) {
      const postsResponse = await handlePostsRequest(request, env, path);
      if (postsResponse) return postsResponse;
    }

    if (path.startsWith('/media')) {
      const mediaResponse = await handleMediaRequest(request, env, path);
      if (mediaResponse) return mediaResponse;
    }

    return errorResponse(request, 'notFound', 404);
  },
};

export type { Env };
