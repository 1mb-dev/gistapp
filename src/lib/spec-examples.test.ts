import { describe, expect, it } from 'vitest';
import { generateSpec } from './generator';
import type { UserAnswers } from './types';

/** Property-assertion tests covering each `DataSource` variant.
 *  Replaces the prior smoke test (length > 0 + presence of "Implementation Order")
 *  with stronger checks that encode the contract of generator output per kind. */

const baseAnswers: UserAnswers = {
  persona: 'developer',
  title: 'Sample App',
  description: 'A sample app for testing the generator.',
  headlineValue: 'Test the generator',
  audience: 'Personal use',
  usageFrequency: 'daily',
  deviceTarget: 'both',
  dataSource: 'no-external',
  scale: 'personal',
  pageCount: 'single',
  hosting: 'cloudflare-pages',
  stackConfirmed: true,
};

describe('generator output per DataSource variant', () => {
  describe("public-api ('Weather Dashboard')", () => {
    const spec = generateSpec({
      ...baseAnswers,
      title: 'Weather Dashboard',
      description: 'Real-time weather app for commuters.',
      audience: 'Commuters',
      dataSource: 'public-api',
      scale: 'public',
      dataFreshness: 'hourly',
      apiDescription: 'Current weather and 7-day forecast by location',
      apiKnownName: 'Open-Meteo',
      pageCount: 'many',
    });

    it('produces a substantive spec', () => expect(spec.length).toBeGreaterThan(1000));
    it('includes Implementation Order section', () =>
      expect(spec).toContain('## Implementation Order'));
    it('includes Suggested Prompt section', () => expect(spec).toContain('## Suggested Prompt'));
    it('mentions the API by known name', () => expect(spec).toContain('Open-Meteo'));
    it('does not emit user-content scaffolding', () => expect(spec).not.toContain('simple-form'));
  });

  describe("user-content ('Idea Tracker')", () => {
    const spec = generateSpec({
      ...baseAnswers,
      title: 'Idea Tracker',
      description: 'Save and revisit personal ideas as I capture them.',
      audience: 'Just me',
      dataSource: 'user-content',
      userInputType: 'user-saves-data',
    });

    it('produces a substantive spec', () => expect(spec.length).toBeGreaterThan(1000));
    it('includes Implementation Order section', () =>
      expect(spec).toContain('## Implementation Order'));
    it('includes Suggested Prompt section', () => expect(spec).toContain('## Suggested Prompt'));
    it('emits User Input & Storage section', () =>
      expect(spec).toContain('### User Input & Storage'));
    it('does not emit external API mock scaffolding', () =>
      expect(spec).not.toContain('Open-Meteo'));
  });

  describe("no-external ('Daily Task Counter')", () => {
    const spec = generateSpec({
      ...baseAnswers,
      title: 'Daily Task Counter',
      description: 'Tally tasks completed each day. Resets at midnight.',
    });

    it('produces a substantive spec', () => expect(spec.length).toBeGreaterThan(500));
    it('includes Implementation Order section', () =>
      expect(spec).toContain('## Implementation Order'));
    it('includes Suggested Prompt section', () => expect(spec).toContain('## Suggested Prompt'));
    it('does not emit Data & Caching section', () =>
      expect(spec).not.toContain('### Data & Caching'));
    it('does not emit external API scaffolding', () =>
      expect(spec).not.toContain('apiDescription'));
  });
});
