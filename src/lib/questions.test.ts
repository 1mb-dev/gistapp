import { describe, it, expect } from 'vitest';
import { getVisibleQuestions, resolveQuestion, getAutoDefault, questions } from './questions';

describe('getVisibleQuestions', () => {
  it('shows base questions and hides conditional ones with no answers', () => {
    const visible = getVisibleQuestions({});
    const ids = visible.map((q) => q.id);

    // Base questions always visible
    expect(ids).toContain('product-brief');
    expect(ids).toContain('scale');
    expect(ids).toContain('hosting');

    // Conditional questions hidden without trigger
    expect(ids).not.toContain('data-freshness');
    expect(ids).not.toContain('user-input');
    expect(ids).not.toContain('offline');
  });

  it('shows data-freshness when dataSource is public-api', () => {
    const visible = getVisibleQuestions({ dataSource: 'public-api' });
    const ids = visible.map((q) => q.id);
    expect(ids).toContain('data-freshness');
    expect(ids).toContain('api-details');
  });

  it('shows user-input when dataSource is user-content', () => {
    const visible = getVisibleQuestions({ dataSource: 'user-content' });
    const ids = visible.map((q) => q.id);
    expect(ids).toContain('user-input');
    expect(ids).not.toContain('data-freshness');
  });

  it('shows offline question for daily + phone usage', () => {
    const visible = getVisibleQuestions({
      usageFrequency: 'daily',
      deviceTarget: 'phone',
    });
    const ids = visible.map((q) => q.id);
    expect(ids).toContain('offline');
  });

  it('shows offline question for daily + unsure device (resolves to both)', () => {
    const visible = getVisibleQuestions({
      usageFrequency: 'daily',
      deviceTarget: 'unsure',
    });
    const ids = visible.map((q) => q.id);
    expect(ids).toContain('offline');
  });

  it('shows data-freshness when dataSource is rss', () => {
    const visible = getVisibleQuestions({ dataSource: 'rss' });
    const ids = visible.map((q) => q.id);
    expect(ids).toContain('data-freshness');
  });

  it('shows user-input when dataSource is user-content', () => {
    const visible = getVisibleQuestions({ dataSource: 'user-content' });
    const ids = visible.map((q) => q.id);
    expect(ids).toContain('user-input');
  });
});

describe('resolveQuestion', () => {
  const dataSourceQ = questions.find((q) => q.id === 'data-source')!;

  it('returns original question for developer persona', () => {
    const resolved = resolveQuestion(dataSourceQ, 'developer');
    expect(resolved.title).toBe(dataSourceQ.title);
  });

  it('applies overlay for new-builder persona', () => {
    const resolved = resolveQuestion(dataSourceQ, 'new-builder');
    expect(resolved.title).toBe('Where does your app get its information?');
    const apiOption = resolved.options?.find((o) => o.id === 'public-api');
    expect(apiOption?.label).toBe('From the internet');
  });

  it('leaves questions without overlays unchanged for new-builder', () => {
    const briefQ = questions.find((q) => q.id === 'product-brief')!;
    const resolved = resolveQuestion(briefQ, 'new-builder');
    expect(resolved.title).toBe(briefQ.title);
  });

  it('applies overlay for Q6a (user-input) for new-builder persona', () => {
    const q = questions.find((q) => q.id === 'user-input')!;
    const resolved = resolveQuestion(q, 'new-builder');
    expect(resolved.title).toBe('Will people type or save things in your app?');
    const opt = resolved.options?.find((o) => o.id === 'simple-form');
    expect(opt?.label).toBe('A short form');
  });

  it('applies overlay for Q10 (offline) for new-builder persona', () => {
    const q = questions.find((q) => q.id === 'offline')!;
    const resolved = resolveQuestion(q, 'new-builder');
    expect(resolved.title).toBe('Should your app work without internet?');
    expect(resolved.subtitle).toContain('every day on their phone');
    const opt = resolved.options?.find((o) => o.id === 'yes');
    expect(opt?.label).toBe('Yes, show something when offline');
  });

  it('applies overlay for Q8a (design-vibe) for new-builder persona', () => {
    const q = questions.find((q) => q.id === 'design-vibe')!;
    const resolved = resolveQuestion(q, 'new-builder');
    expect(resolved.title).toBe('What should your app feel like?');
    const calmOpt = resolved.options?.find((o) => o.id === 'calm');
    expect(calmOpt?.label).toBe('Calm and simple');
  });

  it('does not apply Q6a/Q10/Q8a overlays for developer persona', () => {
    for (const id of ['user-input', 'offline', 'design-vibe']) {
      const q = questions.find((q) => q.id === id)!;
      const resolved = resolveQuestion(q, 'developer');
      expect(resolved.title).toBe(q.title);
    }
  });
});

describe('getAutoDefault', () => {
  it('returns undefined for developer persona', () => {
    expect(getAutoDefault('data-freshness', 'developer')).toBeUndefined();
  });

  it('returns auto-default for new-builder persona', () => {
    expect(getAutoDefault('data-freshness', 'new-builder')).toBe('daily');
    expect(getAutoDefault('hosting', 'new-builder')).toBe('unsure');
    expect(getAutoDefault('page-count', 'new-builder')).toBe('single');
    expect(getAutoDefault('scale', 'new-builder')).toBe('personal');
  });

  it('returns undefined for questions without auto-defaults', () => {
    expect(getAutoDefault('product-brief', 'new-builder')).toBeUndefined();
  });
});
