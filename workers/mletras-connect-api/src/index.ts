import type { Env } from './lib/env';
import { handleAuthRequest } from './routes/auth';
import { handleCommentsRequest } from './routes/comments';
import { handleMediaRequest } from './routes/media';
import { handleNotificationsRequest } from './routes/notifications';
import { handlePostsRequest } from './routes/posts';
import { handleTestRequest } from './routes/test';
import { handleUsersRequest } from './routes/users';
import { errorResponse, handleOptions, jsonResponse } from './lib/cors';
import { sweepOrphanedMedia } from './lib/mediaSweeper';

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sweepOrphanedMedia(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const options = handleOptions(request);
    if (options) return options;

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (path === '/health' && request.method === 'GET') {
      return jsonResponse(request, { ok: true, service: 'mletras-connect-api' });
    }

    const testResponse = await handleTestRequest(request, env, path);
    if (testResponse) return testResponse;

    if (path.startsWith('/auth')) {
      const authResponse = await handleAuthRequest(request, env, path);
      if (authResponse) return authResponse;
    }

    if (path.startsWith('/users')) {
      const usersResponse = await handleUsersRequest(request, env, path);
      if (usersResponse) return usersResponse;
    }

    if (path.startsWith('/posts')) {
      const commentsResponse = await handleCommentsRequest(request, env, path);
      if (commentsResponse) return commentsResponse;

      const postsResponse = await handlePostsRequest(request, env, path);
      if (postsResponse) return postsResponse;
    }

    if (path.startsWith('/notifications')) {
      const notificationsResponse = await handleNotificationsRequest(request, env, path);
      if (notificationsResponse) return notificationsResponse;
    }

    if (path.startsWith('/media')) {
      const mediaResponse = await handleMediaRequest(request, env, path);
      if (mediaResponse) return mediaResponse;
    }

    return errorResponse(request, 'notFound', 404);
  },
};

export type { Env };
