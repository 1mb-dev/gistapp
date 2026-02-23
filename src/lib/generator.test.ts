import { describe, it, expect } from 'vitest';
import type { UserAnswers } from './types';
import { generateSpec, generateFilename } from './generator';

/** Minimal valid answers for a simple personal app */
const minimalAnswers: Partial<UserAnswers> = {
  persona: 'developer',
  title: 'My Tool',
  description: 'A simple personal tool',
  headlineValue: 'Quick utility',
  audience: 'Just me',
  usageFrequency: 'event-driven',
  deviceTarget: 'desktop',
  dataSource: 'no-external',
  scale: 'personal',
  hosting: 'cloudflare-pages',
  pageCount: 'single',
  stackConfirmed: true,
};

/** Answers that produce a standard tier spec */
const standardAnswers: Partial<UserAnswers> = {
  ...minimalAnswers,
  title: 'Weather Dashboard',
  description: 'A weather dashboard pulling from a public API',
  dataSource: 'public-api',
  scale: 'public',
  dataFreshness: 'daily',
  apiDescription: 'Current weather and 7-day forecast',
  apiKnownName: 'Open-Meteo',
  pageCount: 'single',
};

/** Answers that produce a full tier spec */
const fullAnswers: Partial<UserAnswers> = {
  ...standardAnswers,
  title: 'News Aggregator',
  description: 'Public news aggregator with hourly updates',
  dataFreshness: 'hourly',
  pageCount: 'many',
};

describe('generateSpec', () => {
  it('returns valid markdown for empty answers', () => {
    const spec = generateSpec({});
    expect(spec).toContain('# ');
    expect(spec).toContain('## Meta');
    expect(spec.length).toBeGreaterThan(0);
  });

  it('includes required sections for minimal tier', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).toContain('## Meta');
    expect(spec).toContain('## Summary');
    expect(spec).toContain('## UX States');
    expect(spec).toContain('Pre-Ship Checklist');
    expect(spec).toContain('## Implementation Order');
    expect(spec).toContain('## Suggested Prompt');
  });

  it('contains correct complexity tier in meta', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).toContain('Complexity tier: minimal');
  });

  it('includes Worker proxy mention for standard tier with public API', () => {
    const spec = generateSpec(standardAnswers);
    expect(spec).toContain('Worker');
    expect(spec).toContain('Complexity tier: standard');
  });

  it('includes Configuration Checklist for standard tier', () => {
    const spec = generateSpec(standardAnswers);
    expect(spec).toContain('## Configuration Checklist');
  });

  it('includes KV and cron mentions for full tier', () => {
    const spec = generateSpec(fullAnswers);
    expect(spec).toContain('KV');
    expect(spec).toContain('cron');
    expect(spec).toContain('Complexity tier: full');
  });

  it('includes CSP section', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).toContain('## Content Security Policy');
  });

  it('includes Budget Math section for external data + non-personal', () => {
    const spec = generateSpec(standardAnswers);
    expect(spec).toContain('## Free Tier Budget');
  });

  it('omits Budget Math section for personal + no external data', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).not.toContain('## Free Tier Budget');
  });

  it('includes title in spec heading', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).toContain('# My Tool — Gist Specification');
  });
});

describe('generateFilename', () => {
  it('converts a normal title to kebab-case with suffix', () => {
    expect(generateFilename({ title: 'Weather Now' })).toBe('weather-now-gist-spec-v1.0.md');
  });

  it('cleans special characters from title', () => {
    expect(generateFilename({ title: 'My App!! (v2)' })).toBe('my-app-v2-gist-spec-v1.0.md');
  });

  it('uses fallback for missing title', () => {
    expect(generateFilename({})).toBe('my-app-gist-spec-v1.0.md');
  });
});
