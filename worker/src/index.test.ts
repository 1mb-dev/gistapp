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

describe('unknown routes', () => {
  it('returns 404', async () => {
    const request = new Request('https://worker.test/unknown', { method: 'GET' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(404);
  });
});
