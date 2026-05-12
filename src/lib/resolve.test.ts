import { describe, expect, it } from 'vitest';
import { resolveAnswers, resolveDataSource } from './resolve';
import type { UserAnswers } from './types';

const baseAnswers: UserAnswers = {
  persona: 'developer',
  title: 'Test',
  description: 'desc',
  headlineValue: 'value',
  audience: 'devs',
  usageFrequency: 'daily',
  deviceTarget: 'both',
  dataSource: 'no-external',
  scale: 'personal',
  hosting: 'cloudflare-pages',
  pageCount: 'single',
  stackConfirmed: true,
};

describe('resolveDataSource', () => {
  it('maps public-api to its kind', () => {
    expect(resolveDataSource({ dataSource: 'public-api' })).toEqual({ kind: 'public-api' });
  });

  it('maps rss to its kind', () => {
    expect(resolveDataSource({ dataSource: 'rss' })).toEqual({ kind: 'rss' });
  });

  it('maps static-file to its kind', () => {
    expect(resolveDataSource({ dataSource: 'static-file' })).toEqual({ kind: 'static-file' });
  });

  it('maps other to its kind', () => {
    expect(resolveDataSource({ dataSource: 'other' })).toEqual({ kind: 'other' });
  });

  it('maps user-content to its kind', () => {
    expect(resolveDataSource({ dataSource: 'user-content' })).toEqual({ kind: 'user-content' });
  });

  it('maps no-external to its kind', () => {
    expect(resolveDataSource({ dataSource: 'no-external' })).toEqual({ kind: 'no-external' });
  });

  it('folds unsure to no-external', () => {
    expect(resolveDataSource({ dataSource: 'unsure' })).toEqual({ kind: 'no-external' });
  });

  it('folds undefined to no-external', () => {
    expect(resolveDataSource({})).toEqual({ kind: 'no-external' });
  });
});

describe('resolveAnswers', () => {
  it('rewrites dataSource into the discriminated form', () => {
    const resolved = resolveAnswers({ ...baseAnswers, dataSource: 'public-api' });
    expect(resolved.dataSource).toEqual({ kind: 'public-api' });
  });

  it('passes other fields through unchanged', () => {
    const resolved = resolveAnswers({ ...baseAnswers, audience: 'hobbyists', scale: 'public' });
    expect(resolved.audience).toBe('hobbyists');
    expect(resolved.scale).toBe('public');
    expect(resolved.persona).toBe('developer');
  });

  it('folds unsure to no-external on the resolved shape', () => {
    const resolved = resolveAnswers({ ...baseAnswers, dataSource: 'unsure' });
    expect(resolved.dataSource.kind).toBe('no-external');
  });
});
