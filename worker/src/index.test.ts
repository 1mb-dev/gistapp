import { describe, it, expect, vi } from 'vitest';

// Mock KV namespace
function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    list: vi.fn(async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    })),
    delete: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

// Import worker — we test the fetch handler directly
import worker from './index';

function makeEnv(kv?: KVNamespace) {
  return {
    INSIGHTS: kv ?? createMockKV(),
    ADMIN_TOKEN: 'test-secret-token',
  };
}

function postEvent(body: string, env = makeEnv()): Promise<Response> {
  const request = new Request('https://worker.test/api/event', {
    method: 'POST',
    body,
  });
  return worker.fetch(request, env);
}

function getStats(token: string, days?: number, env = makeEnv()): Promise<Response> {
  const url = days ? `https://worker.test/api/stats?days=${days}` : 'https://worker.test/api/stats';
  const request = new Request(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return worker.fetch(request, env);
}

describe('POST /api/event', () => {
  it('accepts valid event and returns 202', async () => {
    const res = await postEvent(
      JSON.stringify({ event: 'persona_selected', persona: 'developer' }),
    );
    expect(res.status).toBe(202);
  });

  it('rejects unknown event with 400', async () => {
    const res = await postEvent(JSON.stringify({ event: 'unknown_event' }));
    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON with 400', async () => {
    const res = await postEvent('not json');
    expect(res.status).toBe(400);
  });

  it('rejects oversized payload with 413', async () => {
    const large = JSON.stringify({ event: 'persona_selected', data: 'x'.repeat(600) });
    const res = await postEvent(large);
    expect(res.status).toBe(413);
  });

  it('rejects missing event field with 400', async () => {
    const res = await postEvent(JSON.stringify({ persona: 'developer' }));
    expect(res.status).toBe(400);
  });

  it('increments KV counters for valid event', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'persona_selected', persona: 'developer' }), env);
    expect(kv.put).toHaveBeenCalled();
  });

  it('includes CORS headers', async () => {
    const res = await postEvent(JSON.stringify({ event: 'spec_downloaded' }));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gist.1mb.dev');
  });
});

describe('GET /api/stats', () => {
  it('returns 401 for missing auth', async () => {
    const request = new Request('https://worker.test/api/stats', { method: 'GET' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(401);
  });

  it('returns 401 for bad token', async () => {
    const res = await getStats('wrong-token');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const res = await getStats('test-secret-token');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  it('clamps days param to 1-30 range', async () => {
    // days=0 should clamp to 1, days=100 should clamp to 30
    const res1 = await getStats('test-secret-token', 0);
    expect(res1.status).toBe(200);

    const res2 = await getStats('test-secret-token', 100);
    expect(res2.status).toBe(200);
  });

  it('includes CORS headers', async () => {
    const res = await getStats('test-secret-token');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gist.1mb.dev');
  });
});

describe('OPTIONS (preflight)', () => {
  it('returns 204 with CORS headers', async () => {
    const request = new Request('https://worker.test/api/event', { method: 'OPTIONS' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gist.1mb.dev');
  });
});

describe('GET /', () => {
  it('returns service identity JSON', async () => {
    const request = new Request('https://worker.test/', { method: 'GET' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ service: 'gist-insights', status: 'ok' });
  });
});

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const request = new Request('https://worker.test/health', { method: 'GET' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });
});

describe('dimensional keys via round-trip', () => {
  it('creates dimensional key for persona_selected', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'persona_selected', persona: 'developer' }), env);

    // Should have written both aggregate and dimensional keys
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':persona_selected'))).toBe(true);
    expect(keys.some((k: string) => k.endsWith(':persona_selected:developer'))).toBe(true);
  });

  it('creates dimensional key for spec_generated with tier', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'spec_generated', tier: 'minimal' }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':spec_generated:minimal'))).toBe(true);
  });

  it('creates dimensional key for question_completed with step index', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'question_completed', stepIndex: 3 }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':question_completed:3'))).toBe(true);
  });

  it('creates dimensional key for feedback', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'feedback', feedback: 'great' }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':feedback:great'))).toBe(true);
  });

  it('rejects malicious dimension values (key injection)', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    // Attempt to inject a colon in the persona value
    await postEvent(
      JSON.stringify({ event: 'persona_selected', persona: 'evil:inject:keys' }),
      env,
    );

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    // Should have aggregate key but NOT the malicious dimensional key
    expect(keys.some((k: string) => k.endsWith(':persona_selected'))).toBe(true);
    expect(keys.some((k: string) => k.includes('evil'))).toBe(false);
  });

  it('rejects dimension values with special characters', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(
      JSON.stringify({ event: 'persona_selected', persona: '../../../etc/passwd' }),
      env,
    );

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.includes('passwd'))).toBe(false);
  });

  it('rejects oversized dimension values', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'persona_selected', persona: 'a'.repeat(100) }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    // Only aggregate key, no dimensional (value > 64 chars)
    expect(putCalls.length).toBe(1);
  });

  it('skips dimensional key for negative step index', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'question_completed', stepIndex: -1 }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    // Only aggregate key, no dimensional
    expect(putCalls.length).toBe(1);
  });

  it('skips dimensional key for non-string persona', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'persona_selected', persona: 42 }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    // Only aggregate key
    expect(putCalls.length).toBe(1);
  });
});

describe('POST then GET round-trip', () => {
  it('events are visible in stats', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);

    // Post some events
    await postEvent(JSON.stringify({ event: 'persona_selected', persona: 'developer' }), env);
    await postEvent(JSON.stringify({ event: 'spec_downloaded' }), env);

    // Get stats
    const res = await getStats('test-secret-token', 1, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, Record<string, number>>;

    // Should have today's data
    const dates = Object.keys(data);
    expect(dates.length).toBe(1);

    const todayData = data[dates[0]];
    expect(todayData['persona_selected']).toBe(1);
    expect(todayData['persona_selected:developer']).toBe(1);
    expect(todayData['spec_downloaded']).toBe(1);
  });
});

describe('unknown routes', () => {
  it('returns 404', async () => {
    const request = new Request('https://worker.test/unknown', { method: 'GET' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(404);
  });
});
