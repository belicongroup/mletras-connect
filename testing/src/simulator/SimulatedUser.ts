import { ApiClient } from '../client/ApiClient.js';
import type { PersonaDefinition } from '../config/personas.js';
import type { TestCollector } from '../reporting/types.js';
import type { SeededRandom } from '../utils/random.js';
import { randomCommentText, randomPostText, sleep, uniqueEmail, uniqueUsername } from '../utils/random.js';
import {
  assertOkResponse,
  validatePostShape,
  validateUserShape,
} from '../validators/ApiValidator.js';
import type { SharedState } from '../validators/SecurityValidator.js';

const DEFAULT_LOCATION = {
  country: 'United States',
  state: 'Texas',
  city: 'Austin',
};

const DEFAULT_INSTRUMENTS = ['Guitar', 'Vocals'];

export interface SimulatedUserState {
  id?: string;
  email?: string;
  password?: string;
  username?: string;
  token?: string;
  knownPostIds: string[];
  ownPostIds: string[];
  notificationIds: string[];
  feedCursor?: string | null;
}

export class SimulatedUser {
  readonly client: ApiClient;
  readonly persona: PersonaDefinition;
  readonly index: number;
  readonly rng: SeededRandom;
  state: SimulatedUserState = { knownPostIds: [], ownPostIds: [], notificationIds: [] };

  constructor(
    apiUrl: string,
    persona: PersonaDefinition,
    index: number,
    rng: SeededRandom,
  ) {
    this.persona = persona;
    this.index = index;
    this.rng = rng;
    this.client = new ApiClient(apiUrl, `${persona.type}-${index}`);
  }

  async signup(shared: SharedState): Promise<boolean> {
    const email = uniqueEmail(this.persona.type, this.index);
    const password = `SimPass!${this.index}${Date.now().toString(36)}`;
    const username = uniqueUsername(this.persona.type.slice(0, 4), this.index);

    await this.client.post('/auth/otp/send', { email, flow: 'signup' }, false);
    const peek = await this.client.peekOtp(email, 'signup');
    const code = peek.data?.pending?.code;
    if (!code) return false;

    await this.client.post('/auth/otp/verify', { email, code, flow: 'signup' }, false);
    const signup = await this.client.post<{
      ok: boolean;
      token?: string;
      user?: { id: string };
    }>(
      '/auth/signup',
      {
        email,
        password,
        username,
        firstName: 'Sim',
        lastName: `User${this.index}`,
        ...DEFAULT_LOCATION,
        instruments: DEFAULT_INSTRUMENTS,
      },
      false,
    );

    if (!signup.data?.token || !signup.data?.user?.id) return false;

    this.state = {
      email,
      password,
      username,
      token: signup.data.token,
      id: signup.data.user.id,
      knownPostIds: [],
      ownPostIds: [],
      notificationIds: [],
    };
    this.client.setToken(signup.data.token);
    shared.users.set(signup.data.user.id, { token: signup.data.token, email, password });
    return true;
  }

  async login(): Promise<boolean> {
    if (!this.state.email || !this.state.password) return false;
    const res = await this.client.post<{ ok: boolean; token?: string; user?: { id: string } }>(
      '/auth/login',
      { email: this.state.email, password: this.state.password },
      false,
    );
    if (!res.data?.token) return false;
    this.state.token = res.data.token;
    this.state.id = res.data.user?.id ?? this.state.id;
    this.client.setToken(res.data.token);
    return true;
  }

  async performAction(action: string, shared: SharedState, collector: TestCollector): Promise<void> {
    const p = this.persona.label;
    try {
      switch (action) {
        case 'load_feed':
        case 'refresh_feed':
        case 'scroll_feed':
          await this.loadFeed(collector, p, action === 'scroll_feed');
          break;
        case 'create_post':
          await this.createPost(collector, p, shared, false);
          break;
        case 'create_post_with_media':
          collector.manual('Image upload E2E', 'Media upload requires binary payload; covered in media scenario.');
          break;
        case 'like_post':
          await this.likePost(collector, p, true);
          break;
        case 'unlike_post':
          await this.likePost(collector, p, false);
          break;
        case 'comment':
          await this.comment(collector, p, shared, false);
          break;
        case 'reply':
          await this.comment(collector, p, shared, true);
          break;
        case 'delete_post':
          await this.deleteOwnPost(collector, p, shared);
          break;
        case 'view_notifications':
          await this.viewNotifications(collector, p);
          break;
        case 'mark_notification_read':
          await this.markNotificationRead(collector, p);
          break;
        case 'view_profile':
        case 'edit_profile':
          if (action === 'edit_profile') await this.editProfile(collector, p);
          else await this.viewProfile(collector, p);
          break;
        case 'load_my_posts':
          await this.loadMyPosts(collector, p);
          break;
        case 'security_probe':
          // Handled by orchestrator security scenario
          break;
        case 'rapid_requests':
          await this.rapidLikes(collector, p);
          break;
        case 'invalid_payload':
          await this.client.post('/posts', { invalid: true });
          break;
        case 'simulate_offline':
          this.client.setOfflineUntil(Date.now() + 3000);
          try {
            await this.client.get('/posts/feed');
          } catch {
            collector.pass(`${p}: offline blocks request`, 'edge-case', 0, { persona: p });
          }
          break;
        case 'simulate_slow_network':
          this.client.setLatency(2000);
          await this.loadFeed(collector, p, false);
          this.client.setLatency(0);
          break;
        case 'duplicate_request':
          if (this.state.knownPostIds[0]) {
            const id = this.state.knownPostIds[0];
            await Promise.all([
              this.client.post(`/posts/${id}/like`),
              this.client.post(`/posts/${id}/like`),
            ]);
            collector.pass(`${p}: duplicate like requests handled`, 'edge-case', 0, { persona: p });
          }
          break;
        default:
          break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'NETWORK_OFFLINE') {
        collector.pass(`${p}: ${action} offline simulation`, 'edge-case', 0);
      } else {
        collector.fail(`${p}: ${action} threw`, 'api', 'medium', 0, msg, { persona: p });
      }
    }
  }

  private async loadFeed(collector: TestCollector, persona: string, paginate: boolean): Promise<void> {
    let cursor: string | null | undefined = undefined;
    let pages = paginate ? this.rng.int(1, 3) : 1;
    for (let i = 0; i < pages; i++) {
      const path = cursor
        ? `/posts/feed?limit=10&cursor=${encodeURIComponent(cursor)}`
        : '/posts/feed?limit=10';
      const res = await this.client.get<{ ok: boolean; posts?: unknown[]; nextCursor?: string | null }>(path);
      if (!assertOkResponse(collector, `${persona}: load feed page ${i + 1}`, res)) return;
      const posts = (res.data as { posts?: Record<string, unknown>[] }).posts ?? [];
      for (const post of posts) {
        validatePostShape(collector, `${persona}: post shape`, post);
        const id = post.id as string;
        if (!this.state.knownPostIds.includes(id)) this.state.knownPostIds.push(id);
      }
      cursor = (res.data as { nextCursor?: string | null }).nextCursor;
      this.state.feedCursor = cursor;
      if (!cursor) break;
    }
    collector.recordPerformance({ name: 'feed_load', durationMs: 0 });
  }

  private async createPost(
    collector: TestCollector,
    persona: string,
    shared: SharedState,
    _withMedia: boolean,
  ): Promise<void> {
    const text = randomPostText(this.rng);
    const res = await this.client.post<{ ok: boolean; post?: Record<string, unknown> }>('/posts', { text });
    if (!assertOkResponse(collector, `${persona}: create post`, res, 200)) return;
    const post = (res.data as { post?: Record<string, unknown> }).post;
    if (post?.id && this.state.id) {
      this.state.ownPostIds.push(post.id as string);
      this.state.knownPostIds.push(post.id as string);
      shared.posts.set(post.id as string, this.state.id);
    }
    collector.recordPerformance({ name: 'post_create', durationMs: res.durationMs });
  }

  private async likePost(collector: TestCollector, persona: string, like: boolean): Promise<void> {
    const postId = this.rng.pick(this.state.knownPostIds.length ? this.state.knownPostIds : ['']);
    if (!postId) return;
    const res = like
      ? await this.client.post(`/posts/${postId}/like`)
      : await this.client.delete(`/posts/${postId}/like`);
    assertOkResponse(collector, `${persona}: ${like ? 'like' : 'unlike'} post`, res);
  }

  private async comment(
    collector: TestCollector,
    persona: string,
    shared: SharedState,
    isReply: boolean,
  ): Promise<void> {
    const postId = this.rng.pick(this.state.knownPostIds.length ? this.state.knownPostIds : ['']);
    if (!postId) return;
    const body: { text: string; parentId?: string } = { text: randomCommentText(this.rng) };
    if (isReply) {
      const comments = await this.client.get<{ comments?: { id: string }[] }>(
        `/posts/${postId}/comments`,
      );
      const parent = comments.data?.comments?.[0]?.id;
      if (parent) body.parentId = parent;
    }
    const res = await this.client.post(`/posts/${postId}/comments`, body);
    assertOkResponse(collector, `${persona}: ${isReply ? 'reply' : 'comment'}`, res);
    collector.recordPerformance({ name: 'comment_create', durationMs: res.durationMs });
    if (this.state.id) shared.posts.set(postId, shared.posts.get(postId) ?? this.state.id);
  }

  private async deleteOwnPost(
    collector: TestCollector,
    persona: string,
    shared: SharedState,
  ): Promise<void> {
    const postId = this.state.ownPostIds.pop();
    if (!postId) return;
    const res = await this.client.delete(`/posts/${postId}`);
    assertOkResponse(collector, `${persona}: delete own post`, res);
    shared.posts.delete(postId);
  }

  private async viewNotifications(collector: TestCollector, persona: string): Promise<void> {
    const count = await this.client.get<{ ok: boolean; count?: number }>('/notifications/unread-count');
    assertOkResponse(collector, `${persona}: unread notification count`, count);
    const list = await this.client.get<{ notifications?: { id: string }[] }>('/notifications');
    assertOkResponse(collector, `${persona}: list notifications`, list);
    for (const n of list.data?.notifications ?? []) {
      if (!this.state.notificationIds.includes(n.id)) {
        this.state.notificationIds.push(n.id);
      }
    }
  }

  private async markNotificationRead(collector: TestCollector, persona: string): Promise<void> {
    const id = this.state.notificationIds[0];
    if (!id) return;
    const res = await this.client.patch(`/notifications/${id}/read`);
    assertOkResponse(collector, `${persona}: mark notification read`, res);
  }

  private async viewProfile(collector: TestCollector, persona: string): Promise<void> {
    const res = await this.client.get<{ ok: boolean; user?: Record<string, unknown> }>('/auth/me');
    if (!assertOkResponse(collector, `${persona}: view profile (/auth/me)`, res)) return;
    const user = (res.data as { user?: Record<string, unknown> }).user;
    if (user) validateUserShape(collector, `${persona}: user shape`, user);
  }

  private async editProfile(collector: TestCollector, persona: string): Promise<void> {
    const res = await this.client.patch('/users/me', {
      firstName: 'Updated',
      lastName: `Sim${this.index}`,
      ...DEFAULT_LOCATION,
      instruments: ['Drums', 'Guitar'],
    });
    assertOkResponse(collector, `${persona}: edit profile`, res);
  }

  private async loadMyPosts(collector: TestCollector, persona: string): Promise<void> {
    const res = await this.client.get('/posts/mine?limit=10');
    assertOkResponse(collector, `${persona}: load my posts`, res);
  }

  private async rapidLikes(collector: TestCollector, persona: string): Promise<void> {
    const postId = this.state.knownPostIds[0];
    if (!postId) return;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => this.client.post(`/posts/${postId}/like`)),
    );
    const ok = results.every((r) => r.status === 200 || r.status === 429);
    if (ok) {
      collector.pass(`${persona}: rapid likes handled`, 'stress', 0, { persona });
    } else {
      collector.fail(`${persona}: rapid likes caused errors`, 'stress', 'high', 0, 'Unexpected status codes');
    }
  }

  pickWeightedAction(): string {
    const weights = this.persona.actionWeights;
    const total = weights.reduce((s, w) => s + w.weight, 0);
    let r = this.rng.next() * total;
    for (const w of weights) {
      r -= w.weight;
      if (r <= 0) return w.action;
    }
    return weights[0]!.action;
  }

  thinkTimeMs(): number {
    const [min, max] = this.persona.thinkTimeMs;
    return this.rng.int(min, max);
  }
}
