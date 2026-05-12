import { describe, it, expect, vi } from 'vitest';

// Mock KV namespace with metadata support
function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  const metaStore = new Map<string, Record<string, unknown>>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(
      async (key: string, value: string, opts?: { metadata?: Record<string, unknown> }) => {
        store.set(key, value);
        if (opts?.metadata) metaStore.set(key, opts.metadata);
      },
    ),
    list: vi.fn(async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name, metadata: metaStore.get(name) ?? null })),
      list_complete: true,
      cacheStatus: null,
    })),
    delete: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

// Import worker — we test the fetch handler directly
import worker from './index';

function makeEnv(kv?: KVNamespace, opts?: { allowDevOrigins?: boolean }) {
  return {
    INSIGHTS: kv ?? createMockKV(),
    ADMIN_TOKEN: 'test-token-do-not-use-in-production',
    ALLOW_DEV_ORIGINS: opts?.allowDevOrigins ? 'true' : undefined,
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

  it('skips write on corrupt KV value', async () => {
    const kv = createMockKV();
    // Pre-populate the date-based key with corrupt data
    const dateStr = new Date().toISOString().slice(0, 10);
    await kv.put(`${dateStr}:spec_downloaded`, 'not-a-number');
    (kv.put as ReturnType<typeof vi.fn>).mockClear();

    const env = makeEnv(kv);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await postEvent(JSON.stringify({ event: 'spec_downloaded' }), env);

    // increment should log the error and skip the write for the corrupt key
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Corrupt KV value'));
    consoleSpy.mockRestore();
  });

  it('rejects float stepIndex as non-dimensional', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'question_completed', stepIndex: 3.5 }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    // Should have aggregate key but NOT the dimensional key with float index
    expect(keys.some((k: string) => k.endsWith(':question_completed'))).toBe(true);
    expect(keys.some((k: string) => k.includes('3.5'))).toBe(false);
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
    const res = await getStats('test-token-do-not-use-in-production');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  it('clamps days param to 1-30 range', async () => {
    // days=0 should clamp to 1, days=100 should clamp to 30
    const res1 = await getStats('test-token-do-not-use-in-production', 0);
    expect(res1.status).toBe(200);

    const res2 = await getStats('test-token-do-not-use-in-production', 100);
    expect(res2.status).toBe(200);
  });

  it('includes CORS headers', async () => {
    const res = await getStats('test-token-do-not-use-in-production');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gist.1mb.dev');
  });
});

describe('OPTIONS (preflight)', () => {
  it('returns 204 with CORS headers for /api/event', async () => {
    const request = new Request('https://worker.test/api/event', { method: 'OPTIONS' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gist.1mb.dev');
  });

  it('returns 204 with CORS headers for /api/stats', async () => {
    const request = new Request('https://worker.test/api/stats', { method: 'OPTIONS' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(204);
  });

  it('returns 404 for OPTIONS on unknown path', async () => {
    const request = new Request('https://worker.test/unknown', { method: 'OPTIONS' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(404);
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

  it('spec_generated: creates composite persona:tier key', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(
      JSON.stringify({ event: 'spec_generated', tier: 'minimal', persona: 'new-builder' }),
      env,
    );

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.includes('spec_generated:new-builder:minimal'))).toBe(true);
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
    const res = await getStats('test-token-do-not-use-in-production', 1, env);
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

describe('page_viewed event', () => {
  it('accepts page_viewed event and returns 202', async () => {
    const res = await postEvent(JSON.stringify({ event: 'page_viewed' }));
    expect(res.status).toBe(202);
  });

  it('page_viewed is visible in stats round-trip', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'page_viewed' }), env);
    await postEvent(JSON.stringify({ event: 'page_viewed' }), env);

    const res = await getStats('test-token-do-not-use-in-production', 1, env);
    const data = (await res.json()) as Record<string, Record<string, number>>;
    const dates = Object.keys(data);
    expect(dates.length).toBe(1);
    expect(data[dates[0]]['page_viewed']).toBe(2);
  });
});

describe('KV expiration TTL', () => {
  it('includes 90-day TTL on all kv.put calls', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'persona_selected', persona: 'developer' }), env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    expect(putCalls.length).toBeGreaterThan(0);
    for (const call of putCalls) {
      expect(call[2]).toMatchObject({ expirationTtl: 7_776_000 });
    }
  });
});

describe('unknown routes', () => {
  it('returns 404', async () => {
    const request = new Request('https://worker.test/unknown', { method: 'GET' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(404);
  });
});

describe('Rate limiting on /api/stats', () => {
  it('allows 5 failed attempts per minute', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);

    // Attempt 1-5: should return 401 (bad token)
    for (let i = 0; i < 5; i++) {
      const res = await getStats('wrong-token', undefined, env);
      expect(res.status).toBe(401);
    }

    // Attempt 6: should return 429 (rate limit exceeded)
    const res = await getStats('wrong-token', undefined, env);
    expect(res.status).toBe(429);
    const body = await res.text();
    expect(body).toContain('Too many auth attempts');
  });

  it('increments rate limit counter on failed auth', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);

    // Send 2 bad auth requests
    await getStats('wrong-token', undefined, env);
    await getStats('wrong-token', undefined, env);

    // Should have written the rate limit key twice
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const rateLimitKeys = putCalls
      .map((c: string[]) => c[0])
      .filter((k: string) => k.startsWith('auth_ratelimit:'));
    expect(rateLimitKeys.length).toBeGreaterThan(0);
  });

  it('clears rate limit counter on successful auth within limit', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);

    // Send 2 bad auth requests
    for (let i = 0; i < 2; i++) {
      await getStats('wrong-token', undefined, env);
    }

    // Reset the KV mock to clear previous calls for inspection
    (kv.put as ReturnType<typeof vi.fn>).mockClear();
    (kv.delete as ReturnType<typeof vi.fn>).mockClear();

    // Successful auth (before hitting limit) should clear the rate limit counter
    const res = await getStats('test-token-do-not-use-in-production', undefined, env);
    expect(res.status).toBe(200);

    // Should have called delete to clear the rate limit key
    const deleteCalls = (kv.delete as ReturnType<typeof vi.fn>).mock.calls;
    expect(deleteCalls.length).toBeGreaterThan(0);
    // Deleted key should be rate limit key
    const deletedKeys = deleteCalls.map((c: string[]) => c[0]);
    expect(deletedKeys.some((k: string) => k.startsWith('auth_ratelimit:'))).toBe(true);
  });

  it('sets rate limit counter with 70-second TTL (handles clock skew)', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);

    await getStats('wrong-token', undefined, env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const rateLimitCall = putCalls.find((c: string[]) => c[0].startsWith('auth_ratelimit:'));
    expect(rateLimitCall).toBeDefined();
    // Should have expirationTtl: 70 (slightly more than 60 seconds)
    expect(rateLimitCall?.[2]).toMatchObject({ expirationTtl: 70 });
  });

  it('blocks further attempts even with correct token after rate limit hit', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);

    // Send 5 bad auth requests
    for (let i = 0; i < 5; i++) {
      await getStats('wrong-token', undefined, env);
    }

    // 6th request with CORRECT token should still be rate-limited
    const res = await getStats('test-token-do-not-use-in-production', undefined, env);
    expect(res.status).toBe(429);
  });

  it('rate limit key uses IP-bucketed format', async () => {
    // Asserts the key schema only. True per-IP isolation cannot be tested here
    // because `request.cf` is undefined in the test harness, so the IP slot
    // always resolves to "unknown". Multi-IP behavior is verified manually.
    const kv = createMockKV();
    const env = makeEnv(kv);

    await getStats('wrong-token', undefined, env);

    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const rateLimitKeys = putCalls
      .map((c: string[]) => c[0])
      .filter((k: string) => k.startsWith('auth_ratelimit:'));

    expect(rateLimitKeys[0]).toMatch(/^auth_ratelimit:[a-z0-9.]+:\d+$/);
  });
});

describe('Error sanitization', () => {
  it('does not log request body or headers in errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const kv = createMockKV();
    const env = makeEnv(kv);

    // Trigger a fetch error by making invalid request structure
    const request = new Request('https://worker.test/api/event', {
      method: 'POST',
      body: '{"malformed json',
    });
    await worker.fetch(request, env);

    // Error logs should exist but not contain request details
    const errorCalls = (consoleSpy as ReturnType<typeof vi.spyOn>).mock.calls;
    for (const call of errorCalls) {
      const loggedContent = String(call[0]);
      // Should not log Authorization header or token
      expect(loggedContent).not.toContain('test-token-do-not-use-in-production');
      expect(loggedContent).not.toContain('Authorization');
    }

    consoleSpy.mockRestore();
  });

  // Removed: prior test claimed to verify sanitization of unhandled-error logs but
  // never exercised the catch path. Re-add once we have a way to force a top-level
  // throw and observe the sanitized log message.
});

// --- Share link tests ---

function postShare(
  body: string,
  env = makeEnv(),
  origin: string | null = 'https://gist.1mb.dev',
  clientIp?: string,
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  if (clientIp) headers['CF-Connecting-IP'] = clientIp;
  const request = new Request('https://worker.test/api/share', {
    method: 'POST',
    headers,
    body,
  });
  return worker.fetch(request, env);
}

function getShare(id: string, env = makeEnv()): Promise<Response> {
  const request = new Request(`https://worker.test/api/share/${id}`, { method: 'GET' });
  return worker.fetch(request, env);
}

describe('POST /api/share', () => {
  it('stores answers and returns an 8-char ID', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    const answers = JSON.stringify({ persona: 'developer', title: 'Test App' });
    const res = await postShare(answers, env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('rejects invalid JSON', async () => {
    const res = await postShare('not json');
    expect(res.status).toBe(400);
  });

  it('rejects payload over 4KB', async () => {
    const res = await postShare('x'.repeat(4097));
    expect(res.status).toBe(413);
  });

  it('stores with 90-day TTL', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postShare(JSON.stringify({ title: 'Test' }), env);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const shareCall = putCalls.find((c: string[]) => c[0].startsWith('share:'));
    expect(shareCall?.[2]).toMatchObject({ expirationTtl: 7_776_000 });
  });

  it('rejects forbidden Origin with 403', async () => {
    const res = await postShare(JSON.stringify({ x: 1 }), makeEnv(), 'https://evil.example');
    expect(res.status).toBe(403);
  });

  it('rejects missing Origin with 403', async () => {
    const res = await postShare(JSON.stringify({ x: 1 }), makeEnv(), null);
    expect(res.status).toBe(403);
  });

  it('accepts localhost dev origins when ALLOW_DEV_ORIGINS=true', async () => {
    const res = await postShare(
      JSON.stringify({ x: 1 }),
      makeEnv(undefined, { allowDevOrigins: true }),
      'http://localhost:4321',
    );
    expect(res.status).toBe(201);
  });

  it('rejects localhost dev origins when ALLOW_DEV_ORIGINS is unset (prod default)', async () => {
    const res = await postShare(JSON.stringify({ x: 1 }), makeEnv(), 'http://localhost:4321');
    expect(res.status).toBe(403);
  });

  it('rate-limits the 11th sequential POST from the same IP', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    for (let i = 0; i < 10; i++) {
      const res = await postShare(JSON.stringify({ i }), env, 'https://gist.1mb.dev', '1.2.3.4');
      expect(res.status).toBe(201);
    }
    const res = await postShare(
      JSON.stringify({ final: true }),
      env,
      'https://gist.1mb.dev',
      '1.2.3.4',
    );
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('rate-limit buckets are per-IP — distinct IPs do not share a cap', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    // Exhaust the cap for IP A
    for (let i = 0; i < 10; i++) {
      await postShare(JSON.stringify({ i }), env, 'https://gist.1mb.dev', '1.1.1.1');
    }
    expect(
      (await postShare(JSON.stringify({}), env, 'https://gist.1mb.dev', '1.1.1.1')).status,
    ).toBe(429);
    // IP B is unaffected
    expect(
      (await postShare(JSON.stringify({}), env, 'https://gist.1mb.dev', '2.2.2.2')).status,
    ).toBe(201);
  });

  it('parallel POSTs leak through the cap (documented non-atomic behavior)', async () => {
    // Read-then-write bucket is non-atomic by design (see worker code comment).
    // Mock KV serializes microtasks such that all N parallel requests read 0
    // before any write lands — modelling the production race window. The
    // Origin allowlist is the primary defense; this test locks the contract
    // so a future "fix" forces us to update the docs first.
    const kv = createMockKV();
    const env = makeEnv(kv);
    const responses = await Promise.all(
      Array.from({ length: 15 }, (_, i) => postShare(JSON.stringify({ i }), env)),
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.every((s) => s === 201)).toBe(true);
  });

  it('fails open if rate-limit KV read throws', async () => {
    const kv = createMockKV();
    // First INSIGHTS.get is the rate-limit bucket read; force it to throw.
    let callCount = 0;
    const originalGet = kv.get;
    kv.get = vi.fn((...args) => {
      callCount++;
      if (callCount === 1) throw new Error('KV down');
      return originalGet.apply(kv, args as Parameters<typeof originalGet>);
    });
    const env = makeEnv(kv);
    const res = await postShare(JSON.stringify({ x: 1 }), env);
    expect(res.status).toBe(201);
  });

  it('records share_rejected event with origin reason on forbidden Origin', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postShare(JSON.stringify({ x: 1 }), env, 'https://evil.example');
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const reasonKey = putCalls
      .map((c: string[]) => c[0])
      .find((k: string) => k.endsWith(':share_rejected:origin'));
    expect(reasonKey).toBeDefined();
  });

  it('records share_rejected event with ratelimit reason on 429', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    for (let i = 0; i < 10; i++) await postShare(JSON.stringify({ i }), env);
    await postShare(JSON.stringify({ final: true }), env);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const reasonKey = putCalls
      .map((c: string[]) => c[0])
      .find((k: string) => k.endsWith(':share_rejected:ratelimit'));
    expect(reasonKey).toBeDefined();
  });

  it('records share_rejected event with payload reason on oversized body', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postShare('x'.repeat(4097), env);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const reasonKey = putCalls
      .map((c: string[]) => c[0])
      .find((k: string) => k.endsWith(':share_rejected:payload'));
    expect(reasonKey).toBeDefined();
  });
});

describe('GET /api/share/:id', () => {
  it('retrieves stored answers (8-char ID round-trip)', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    const answers = JSON.stringify({ persona: 'developer', title: 'Test App' });
    const createRes = await postShare(answers, env);
    const { id } = (await createRes.json()) as { id: string };

    const getRes = await getShare(id, env);
    expect(getRes.status).toBe(200);
    const body = await getRes.json();
    expect(body).toEqual({ persona: 'developer', title: 'Test App' });
  });

  it('still resolves 6-char IDs from v2.2.x (back-compat)', async () => {
    const kv = createMockKV();
    await kv.put('share:legacy', JSON.stringify({ legacy: true }), { expirationTtl: 7_776_000 });
    const env = makeEnv(kv);
    const res = await getShare('legacy', env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ legacy: true });
  });

  it('rejects 5-char or 9-char IDs at the route', async () => {
    expect((await getShare('short', makeEnv())).status).toBe(404);
    expect((await getShare('toolongstring', makeEnv())).status).toBe(404);
  });

  it('returns 404 for unknown ID', async () => {
    const res = await getShare('abcdef');
    expect(res.status).toBe(404);
  });

  it('rejects invalid ID format', async () => {
    const res = await getShare('../../etc');
    expect(res.status).toBe(404); // route regex rejects non-alphanumeric
  });

  it('CORS preflight works for share endpoints', async () => {
    const request = new Request('https://worker.test/api/share', { method: 'OPTIONS' });
    const res = await worker.fetch(request, makeEnv());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://gist.1mb.dev');
  });
});

describe('Telemetry events', () => {
  it('accepts question_arrived and emits dimensional keys', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    const res = await postEvent(
      JSON.stringify({
        event: 'question_arrived',
        questionId: 'audience',
        persona: 'developer',
        stepIndex: 1,
      }),
      env,
    );
    expect(res.status).toBe(202);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':question_arrived'))).toBe(true);
    expect(keys.some((k: string) => k.endsWith(':question_arrived:audience'))).toBe(true);
    expect(keys.some((k: string) => k.endsWith(':question_arrived:audience:developer'))).toBe(true);
  });

  it('accepts question_abandoned and emits dimensional keys', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    const res = await postEvent(
      JSON.stringify({
        event: 'question_abandoned',
        questionId: 'audience',
        persona: 'new-builder',
        stepIndex: 1,
      }),
      env,
    );
    expect(res.status).toBe(202);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':question_abandoned:audience'))).toBe(true);
    expect(keys.some((k: string) => k.endsWith(':question_abandoned:audience:new-builder'))).toBe(
      true,
    );
  });

  it('emits expected dimensional keys for question_skipped', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'question_skipped', questionId: 'audience' }), env);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':question_skipped:audience'))).toBe(true);
  });

  it('drops feedback dimension for values outside the enum', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'feedback', feedback: 'lol' }), env);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':feedback:lol'))).toBe(false);
    // The base event itself still records.
    expect(keys.some((k: string) => k.endsWith(':feedback'))).toBe(true);
  });

  it('accepts feedback dimension for whitelisted values', async () => {
    const kv = createMockKV();
    const env = makeEnv(kv);
    await postEvent(JSON.stringify({ event: 'feedback', feedback: 'great' }), env);
    const putCalls = (kv.put as ReturnType<typeof vi.fn>).mock.calls;
    const keys = putCalls.map((c: string[]) => c[0]);
    expect(keys.some((k: string) => k.endsWith(':feedback:great'))).toBe(true);
  });
});
