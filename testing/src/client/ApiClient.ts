export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  headers: Record<string, string>;
  durationMs: number;
  rawText: string;
}

export interface ApiErrorBody {
  ok: false;
  error: string;
}

export class ApiClient {
  private token: string | null = null;
  private offlineUntil = 0;
  private latencyMs = 0;
  private abortNext = false;

  constructor(
    readonly baseUrl: string,
    readonly label: string,
  ) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  /** Simulate offline mode until timestamp. */
  setOfflineUntil(timestamp: number): void {
    this.offlineUntil = timestamp;
  }

  setLatency(ms: number): void {
    this.latencyMs = ms;
  }

  setAbortNext(abort: boolean): void {
    this.abortNext = abort;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      auth?: boolean;
      headers?: Record<string, string>;
      timeoutMs?: number;
    },
  ): Promise<ApiResponse<T>> {
    if (Date.now() < this.offlineUntil) {
      throw new Error('NETWORK_OFFLINE');
    }

    if (this.latencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options?.headers,
    };

    const useAuth = options?.auth !== false && this.token;
    if (useAuth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let body: BodyInit | undefined;
    if (options?.body !== undefined) {
      if (options.body instanceof ArrayBuffer || options.body instanceof Blob) {
        body = options.body as BodyInit;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
    }

    const controller = new AbortController();
    const timeout = options?.timeoutMs ?? 30_000;
    const timer = setTimeout(() => controller.abort(), timeout);

    if (this.abortNext) {
      this.abortNext = false;
      controller.abort();
    }

    const start = performance.now();
    let response: Response;
    try {
      response = await fetch(url, { method, headers, body, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    const durationMs = performance.now() - start;
    const rawText = await response.text();
    let data: T;
    try {
      data = rawText ? (JSON.parse(rawText) as T) : ({} as T);
    } catch {
      data = { raw: rawText } as T;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => {
      responseHeaders[k] = v;
    });

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: responseHeaders,
      durationMs,
      rawText,
    };
  }

  async get<T>(path: string, auth = true): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, { auth });
  }

  async post<T>(path: string, body?: unknown, auth = true): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { body, auth });
  }

  async patch<T>(path: string, body?: unknown, auth = true): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, { body, auth });
  }

  async delete<T>(path: string, auth = true): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, { auth });
  }

  // --- Test helpers (require ENABLE_TEST_ROUTES) ---

  async peekOtp(email: string, flow: 'signup' | 'reset' = 'signup') {
    return this.get<{ ok: boolean; pending: { code: string } | null; verified: boolean }>(
      `/__test__/otp/peek?email=${encodeURIComponent(email)}&flow=${flow}`,
      false,
    );
  }

  async dbConsistency() {
    return this.get<{
      ok: boolean;
      issues: Array<{ check: string; severity: string; message: string }>;
      issueCount: number;
    }>('/__test__/db/consistency', false);
  }

  async dbStats() {
    return this.get<{ ok: boolean; stats: Record<string, number> }>('/__test__/db/stats', false);
  }

  async testHealth() {
    return this.get<{ ok: boolean; testMode: boolean }>('/__test__/health', false);
  }
}
