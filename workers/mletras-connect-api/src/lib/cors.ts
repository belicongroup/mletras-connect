const ALLOWED_ORIGINS = new Set([
  'http://localhost:8081',
  'http://localhost:19006',
  'https://mletras-connect.pages.dev',
  'https://connect.mletras.com',
]);

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : ALLOWED_ORIGINS.values().next().value!;

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleOptions(request: Request): Response | null {
  if (request.method !== 'OPTIONS') return null;
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  });
}

export function errorResponse(
  request: Request,
  error: string,
  status = 400,
): Response {
  return jsonResponse(request, { ok: false, error }, status);
}
