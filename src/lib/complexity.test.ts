import { describe, it, expect } from 'vitest';
import { determineComplexity, needsWorkerProxy, needsCron, shouldRecommendPWA } from './complexity';

describe('determineComplexity', () => {
  it('returns minimal for empty answers', () => {
    expect(determineComplexity({})).toBe('minimal');
  });

  it('returns minimal for personal + single page + no external data', () => {
    expect(
      determineComplexity({
        scale: 'personal',
        pageCount: 'single',
        dataSource: 'no-external',
      }),
    ).toBe('minimal');
  });

  it('returns minimal when all relevant values are unsure', () => {
    expect(
      determineComplexity({
        dataSource: 'unsure',
        dataFreshness: 'unsure',
        pageCount: 'unsure',
        scale: 'unsure',
      }),
    ).toBe('minimal');
  });

  it('returns standard when user saves data', () => {
    expect(
      determineComplexity({
        userInputType: 'user-saves-data',
        scale: 'personal',
        pageCount: 'single',
      }),
    ).toBe('standard');
  });

  it('returns standard for public + public-api', () => {
    expect(
      determineComplexity({
        scale: 'public',
        dataSource: 'public-api',
        pageCount: 'single',
      }),
    ).toBe('standard');
  });

  it('returns standard for many pages without public scale', () => {
    expect(
      determineComplexity({
        pageCount: 'many',
        scale: 'personal',
      }),
    ).toBe('standard');
  });

  it('returns standard for few pages + public-api + non-personal scale', () => {
    expect(
      determineComplexity({
        pageCount: 'few',
        dataSource: 'public-api',
        scale: 'friends',
      }),
    ).toBe('standard');
  });

  it('returns full for many pages + public scale', () => {
    expect(
      determineComplexity({
        pageCount: 'many',
        scale: 'public',
      }),
    ).toBe('full');
  });

  it('returns full for hourly freshness + public scale', () => {
    expect(
      determineComplexity({
        dataFreshness: 'hourly',
        scale: 'public',
        pageCount: 'single',
      }),
    ).toBe('full');
  });

  it('returns full for realtime freshness + public scale', () => {
    expect(
      determineComplexity({
        dataFreshness: 'realtime',
        scale: 'public',
        pageCount: 'single',
      }),
    ).toBe('full');
  });

  it('returns full for realtime freshness + friends scale', () => {
    expect(
      determineComplexity({
        dataFreshness: 'realtime',
        scale: 'friends',
        pageCount: 'single',
      }),
    ).toBe('full');
  });

  it('returns full for hourly freshness + friends scale', () => {
    expect(
      determineComplexity({
        dataFreshness: 'hourly',
        scale: 'friends',
        pageCount: 'single',
      }),
    ).toBe('full');
  });
});

describe('needsWorkerProxy', () => {
  it('returns true for public scale + public-api', () => {
    expect(needsWorkerProxy({ scale: 'public', dataSource: 'public-api' })).toBe(true);
  });

  it('returns false for personal scale', () => {
    expect(needsWorkerProxy({ scale: 'personal', dataSource: 'public-api' })).toBe(false);
  });

  it('returns false for no-external data', () => {
    expect(needsWorkerProxy({ scale: 'public', dataSource: 'no-external' })).toBe(false);
  });

  it('returns false when dataSource is unsure (resolves to no-external)', () => {
    expect(needsWorkerProxy({ scale: 'public', dataSource: 'unsure' })).toBe(false);
  });

  it('returns true for public scale + rss', () => {
    expect(needsWorkerProxy({ scale: 'public', dataSource: 'rss' })).toBe(true);
  });

  it('returns true for public scale + other data source', () => {
    expect(needsWorkerProxy({ scale: 'public', dataSource: 'other' })).toBe(true);
  });

  it('returns false for non-public scale + other data source', () => {
    expect(needsWorkerProxy({ scale: 'personal', dataSource: 'other' })).toBe(false);
  });
});

describe('needsCron', () => {
  it('returns true for hourly freshness + non-personal scale', () => {
    expect(needsCron({ dataFreshness: 'hourly', scale: 'public' })).toBe(true);
  });

  it('returns false for daily freshness', () => {
    expect(needsCron({ dataFreshness: 'daily', scale: 'public' })).toBe(false);
  });

  it('returns false for hourly + personal scale', () => {
    expect(needsCron({ dataFreshness: 'hourly', scale: 'personal' })).toBe(false);
  });

  it('returns false when freshness is unsure (resolves to daily)', () => {
    expect(needsCron({ dataFreshness: 'unsure', scale: 'public' })).toBe(false);
  });

  it('returns true for hourly freshness + friends scale', () => {
    expect(needsCron({ dataFreshness: 'hourly', scale: 'friends' })).toBe(true);
  });
});

describe('shouldRecommendPWA', () => {
  it('returns true for daily + phone', () => {
    expect(shouldRecommendPWA({ usageFrequency: 'daily', deviceTarget: 'phone' })).toBe(true);
  });

  it('returns true for daily + both', () => {
    expect(shouldRecommendPWA({ usageFrequency: 'daily', deviceTarget: 'both' })).toBe(true);
  });

  it('returns false for weekly usage', () => {
    expect(shouldRecommendPWA({ usageFrequency: 'weekly', deviceTarget: 'phone' })).toBe(false);
  });

  it('returns false for daily + desktop only', () => {
    expect(shouldRecommendPWA({ usageFrequency: 'daily', deviceTarget: 'desktop' })).toBe(false);
  });

  it('returns true for daily + unsure (resolves to both)', () => {
    expect(shouldRecommendPWA({ usageFrequency: 'daily', deviceTarget: 'unsure' })).toBe(true);
  });
});
