interface Env {
  INSIGHTS: KVNamespace;
  ADMIN_TOKEN: string;
}

const ALLOWED_EVENTS = [
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

const MAX_PAYLOAD_BYTES = 512;

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
  const current = Number(await kv.get(key)) || 0;
  await kv.put(key, String(current + 1));
}

/** Validate dimensional values to prevent KV key injection.
 *  Only lowercase alphanumeric, hyphens, and underscores allowed. */
const SAFE_VALUE = /^[a-z0-9_-]{1,64}$/;

function safeDimensionValue(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  return SAFE_VALUE.test(val) ? val : null;
}

/** Derive dimensional KV keys from an event payload.
 *  Each event = 1–3 writes. Budget: ~300–1000 events/day on free tier (1K writes/day). */
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
    const v = safeDimensionValue(data.tier);
    if (v) keys.push(`${date}:spec_generated:${v}`);
  }
  if (
    event === 'question_completed' &&
    typeof data.stepIndex === 'number' &&
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
  if (raw.length > MAX_PAYLOAD_BYTES) {
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
  const auth = request.headers.get('Authorization');
  if (!auth || auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return corsResponse('Unauthorized', 401);
  }

  if (!env.INSIGHTS) {
    console.error('INSIGHTS KV binding is not configured');
    return corsResponse('Service misconfigured', 500);
  }

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days')) || 7));

  const results: Record<string, Record<string, number>> = {};

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().slice(0, 10);

    // KV list returns up to 1000 keys per call. At current traffic (~tens of events/day),
    // pagination is not needed.
    const listed = await env.INSIGHTS.list({ prefix: `${dateStr}:` });
    const dayData: Record<string, number> = {};

    const entries = await Promise.all(
      listed.keys.map(async (key: { name: string }) => {
        const val = await env.INSIGHTS.get(key.name);
        return { name: key.name, value: Number(val) || 0 };
      }),
    );

    for (const entry of entries) {
      // Strip date prefix for cleaner keys
      const shortKey = entry.name.slice(dateStr.length + 1);
      dayData[shortKey] = entry.value;
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

      // CORS preflight (defensive — sendBeacon with text/plain is a simple request)
      if (request.method === 'OPTIONS') {
        return corsResponse(null, 204);
      }

      if (url.pathname === '/' && request.method === 'GET') {
        return new Response(JSON.stringify({ service: 'gist-insights', status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response('ok', { status: 200 });
      }

      if (url.pathname === '/api/event' && request.method === 'POST') {
        return handleEvent(request, env);
      }

      if (url.pathname === '/api/stats' && request.method === 'GET') {
        return handleStats(request, env);
      }

      return corsResponse('Not found', 404);
    } catch (err) {
      console.error('Unhandled worker error:', err);
      return corsResponse('Internal error', 500);
    }
  },
};
