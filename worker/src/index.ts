interface Env {
  INSIGHTS: KVNamespace;
  ADMIN_TOKEN: string;
}

const ALLOWED_EVENTS = [
  'page_viewed',
  'persona_selected',
  'question_completed',
  'question_skipped',
  'spec_generated',
  'spec_downloaded',
  'spec_copied',
  'prompt_copied',
  'feedback',
] as const;

type AllowedEvent = (typeof ALLOWED_EVENTS)[number];

const MAX_PAYLOAD_CHARS = 512;

// CORS only applies to browsers; use curl for local testing. For browser testing
// with wrangler dev, requests from localhost won't match this origin — test with
// curl or deploy to staging.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://gist.1mb.dev',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function corsResponse(body: string | null, status: number): Response {
  return new Response(body, { status, headers: CORS_HEADERS });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Increment a KV counter. Read-increment-write is not atomic —
 *  at Gist's traffic (~tens of events/day) collisions are negligible. */
async function increment(kv: KVNamespace, key: string): Promise<void> {
  const raw = await kv.get(key);
  const current = Number(raw);
  if (raw !== null && isNaN(current)) {
    console.error(`Corrupt KV value for key "${key}": "${raw}"`);
    return;
  }
  const newCount = (isNaN(current) ? 0 : current) + 1;
  await kv.put(key, String(newCount), {
    expirationTtl: 7_776_000, // 90 days
    metadata: { count: newCount },
  });
}

/** Constant-time string comparison to prevent timing attacks on token auth.
 *  Pads shorter input to match the longer so execution time depends only on
 *  max(a.length, b.length), not on whether lengths differ. */
function timingSafeCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  const len = Math.max(bufA.length, bufB.length);
  // Length mismatch flag — incorporated into result without early return
  let mismatch = bufA.length !== bufB.length ? 1 : 0;
  for (let i = 0; i < len; i++) {
    mismatch |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return mismatch === 0;
}

/** Validate dimensional values to prevent KV key injection.
 *  Only lowercase alphanumeric, hyphens, and underscores allowed. */
const SAFE_VALUE = /^[a-z0-9_-]{1,64}$/;

function safeDimensionValue(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  return SAFE_VALUE.test(val) ? val : null;
}

/** Derive dimensional KV keys from an event payload.
 *  Each event = 1–3 writes. Budget: ~300–1000 events/day on free tier (1K writes/day).
 *  For spec_generated, also creates composite persona:tier key for cross-dimensional analysis. */
function getDimensionalKeys(
  date: string,
  event: AllowedEvent,
  data: Record<string, unknown>,
): string[] {
  const keys = [`${date}:${event}`];

  if (event === 'persona_selected') {
    const v = safeDimensionValue(data.persona);
    if (v) keys.push(`${date}:persona_selected:${v}`);
  }
  if (event === 'spec_generated') {
    const tier = safeDimensionValue(data.tier);
    if (tier) keys.push(`${date}:spec_generated:${tier}`);

    // Add composite persona:tier key for dashboard cross-dimensional analysis
    const persona = safeDimensionValue(data.persona);
    if (tier && persona) {
      keys.push(`${date}:spec_generated:${persona}:${tier}`);
    }
  }
  if (
    event === 'question_completed' &&
    typeof data.stepIndex === 'number' &&
    Number.isInteger(data.stepIndex) &&
    data.stepIndex >= 0 &&
    data.stepIndex < 100
  ) {
    keys.push(`${date}:question_completed:${data.stepIndex}`);
  }
  if (event === 'question_skipped') {
    const v = safeDimensionValue(data.questionId);
    if (v) keys.push(`${date}:question_skipped:${v}`);
  }
  if (event === 'feedback') {
    const v = safeDimensionValue(data.feedback);
    if (v) keys.push(`${date}:feedback:${v}`);
  }

  return keys;
}

async function handleEvent(request: Request, env: Env): Promise<Response> {
  if (!env.INSIGHTS) {
    console.error('INSIGHTS KV binding is not configured');
    return corsResponse('Service misconfigured', 500);
  }

  const raw = await request.text();
  if (raw.length > MAX_PAYLOAD_CHARS) {
    return corsResponse('Payload too large', 413);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return corsResponse('Invalid JSON', 400);
  }

  const event = payload.event;
  if (typeof event !== 'string' || !ALLOWED_EVENTS.includes(event as AllowedEvent)) {
    return corsResponse('Unknown event', 400);
  }

  const date = today();
  const keys = getDimensionalKeys(date, event as AllowedEvent, payload);
  await Promise.all(keys.map((key) => increment(env.INSIGHTS, key)));

  return corsResponse(null, 202);
}

async function handleStats(request: Request, env: Env): Promise<Response> {
  // Rate limiting: 5 attempts per minute per IP. Prevents brute force attacks.
  // Cloudflare Workers provides clientIp in request.cf
  const clientIp = (request.cf?.clientIp as string) || 'unknown';
  const now = Math.floor(Date.now() / 1000);
  const minuteKey = `auth_ratelimit:${clientIp}:${now - (now % 60)}`; // Bucket by minute

  const raw = await env.INSIGHTS.get(minuteKey);
  const attempts = Math.max(0, parseInt(raw || '0', 10));

  if (attempts >= 5) {
    // After 5 failures, reject further attempts for this minute
    return corsResponse('Too many auth attempts. Try again in a moment.', 429);
  }

  const auth = request.headers.get('Authorization');
  if (!auth || !timingSafeCompare(auth, `Bearer ${env.ADMIN_TOKEN}`)) {
    // Log failed attempt without exposing the token
    await env.INSIGHTS.put(minuteKey, String(attempts + 1), {
      expirationTtl: 70, // Slightly more than a minute to handle clock skew
    });
    return corsResponse('Unauthorized', 401);
  }

  // Auth succeeded. Clear the rate limit counter for this IP.
  await env.INSIGHTS.delete(minuteKey);

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days')) || 7));

  const results: Record<string, Record<string, number>> = {};

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    // KV list returns up to 1000 keys per call with metadata. At current traffic
    // (~tens of events/day), pagination is not needed. Count stored in metadata
    // during put() avoids N+1 individual get() calls.
    const listed = await env.INSIGHTS.list({ prefix: `${dateStr}:` });
    const dayData: Record<string, number> = {};

    for (const key of listed.keys) {
      const shortKey = key.name.slice(dateStr.length + 1);
      const meta = key.metadata as { count?: number } | null;
      dayData[shortKey] = meta?.count ?? 0;
    }

    if (Object.keys(dayData).length > 0) {
      results[dateStr] = dayData;
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // CORS preflight — scoped to API endpoints only
      if (
        request.method === 'OPTIONS' &&
        (url.pathname === '/api/event' || url.pathname === '/api/stats')
      ) {
        return corsResponse(null, 204);
      }

      // No CORS: monitoring endpoints, not called from browser
      if (url.pathname === '/' && request.method === 'GET') {
        return new Response(JSON.stringify({ service: 'gist-insights', status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/health' && (request.method === 'GET' || request.method === 'HEAD')) {
        return new Response(request.method === 'HEAD' ? null : 'ok', { status: 200 });
      }

      if (url.pathname === '/api/event' && request.method === 'POST') {
        return handleEvent(request, env);
      }

      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return handleStats(request, env);
      }

      return corsResponse('Not found', 404);
    } catch (err) {
      // Log error without exposing request body, headers, or tokens.
      // Extract only the error message/type for debugging.
      const errorMsg =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err).slice(0, 100);
      console.error('Unhandled worker error:', errorMsg);
      return corsResponse('Internal error', 500);
    }
  },
};
