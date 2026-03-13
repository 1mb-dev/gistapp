import { describe, it, expect } from 'vitest';
import type { UserAnswers } from './types';
import { generateSpec, generateFilename, extractSuggestedPrompt } from './generator';

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

/** Answers for a simple form submission app (user-content, no storage, new-builder persona) */
const userContentSimpleAnswers: Partial<UserAnswers> = {
  ...minimalAnswers,
  persona: 'new-builder',
  title: 'Feedback Widget',
  description: 'A feedback form that collects user suggestions',
  dataSource: 'user-content',
  userInputType: 'simple-form',
};

/** Answers for an app where users create and save data */
const userContentSavesDataAnswers: Partial<UserAnswers> = {
  ...minimalAnswers,
  title: 'My Notes',
  description: 'A personal notes app where users create and organize notes',
  usageFrequency: 'daily',
  deviceTarget: 'both',
  dataSource: 'user-content',
  userInputType: 'user-saves-data',
  scale: 'friends',
  pageCount: 'few',
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

  it('includes User Input & Storage section for user-content answers', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      dataSource: 'user-content',
      userInputType: 'simple-form',
    });
    expect(spec).toContain('### User Input & Storage');
    expect(spec).toContain('Simple form submission');
  });

  it('sanitizes title with newlines to a single-line heading', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      title: 'My\nBroken\nTitle',
    });
    expect(spec).toContain('# My Broken Title — Gist Specification');
    expect(spec).not.toContain('# My\n');
  });

  it('escapes markdown heading in description', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      description: '## Injected heading',
    });
    expect(spec).toContain('\\## Injected heading');
    expect(spec).not.toContain('\n## Injected heading');
  });

  it('escapes blockquote marker in description', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      description: '> Injected quote',
    });
    expect(spec).toContain('\\> Injected quote');
  });

  it('passes normal description through unchanged', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      description: 'A simple weather app for commuters',
    });
    expect(spec).toContain('A simple weather app for commuters');
  });

  // --- User-content path tests ---

  it('simple-form: Data Flow describes form submission, not API fetch', () => {
    const spec = generateSpec(userContentSimpleAnswers);
    expect(spec).toContain('User fills out form');
    expect(spec).not.toContain('Browser fetches data directly from API');
  });

  it('user-saves-data: Data Flow describes storage, not API fetch', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('persists to storage');
    expect(spec).not.toContain('Browser fetches data directly from API');
  });

  it('user-saves-data: Implementation Order includes storage step', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toMatch(/storage/i);
    expect(spec).toContain('Storage backend');
  });

  it('user-saves-data: UX States includes empty state', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('Empty / First Use');
  });

  it('user-saves-data: UX States includes storage error', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('Error (Storage)');
  });

  it('simple-form: CSP connect-src allows external handlers', () => {
    const spec = generateSpec(userContentSimpleAnswers);
    expect(spec).toContain("connect-src 'self' https:");
  });

  it('user-saves-data: Budget Math includes database limits', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('Database');
  });

  it('standard tier without Worker: no Worker health endpoint', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).not.toContain('health route to your Worker');
  });

  it('Summary includes agent guidance', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).toContain('do not assume');
  });

  it('Implementation Order includes verification checkpoint', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).toContain('Checkpoint');
  });

  it('Implementation Order references Pre-Ship Checklist', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).toContain('Pre-Ship Checklist');
    // Specifically in the Polish step of Implementation Order
    const implSection = spec.split('## Implementation Order')[1]?.split('## ')[0] ?? '';
    expect(implSection).toContain('Pre-Ship Checklist');
  });

  it('standard tier with Astro: does not recommend tinyrouter', () => {
    const spec = generateSpec({ ...standardAnswers, pageCount: 'few' });
    expect(spec).not.toContain('tinyrouter');
  });

  it('user-saves-data: includes complexity warning', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('complexity');
  });

  it('user-saves-data: produces standard tier', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('Complexity tier: standard');
  });

  it('display-only: Data Flow describes static content, not form or API', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      dataSource: 'user-content',
      userInputType: 'display-only',
    });
    expect(spec).toContain('pre-loaded in HTML');
    expect(spec).not.toContain('User fills out form');
    expect(spec).not.toContain('persists to storage');
  });

  it('user-saves-data on personal scale: includes Budget Math', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      dataSource: 'user-content',
      userInputType: 'user-saves-data',
      scale: 'personal',
    });
    expect(spec).toContain('## Free Tier Budget');
    expect(spec).toContain('Database');
  });

  it('user-saves-data: CSP connect-src allows cloud database calls', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain("connect-src 'self' https:");
  });

  it('new-builder persona: includes reassuring hints for non-technical users', () => {
    const spec = generateSpec(userContentSimpleAnswers);
    expect(spec).toContain('your AI assistant will handle the technical details');
    expect(spec).toContain("You don't need to understand every technical section");
  });

  it('developer persona: does not include new-builder hints', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).not.toContain('your AI assistant will handle the technical details');
  });

  // --- Part 1: Generator Observation Fixes ---

  // Issue 1: Analytics "Worker endpoint" text scoping
  it('standard tier without Worker: omits Worker endpoint text', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('Analytics');
    expect(spec).not.toContain('Worker endpoint');
    expect(spec).toContain('lightweight analytics service');
  });

  // Issue 2: Loading/Offline UX States guards
  it('display-only user-content: omits Loading and Offline states', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      dataSource: 'user-content',
      userInputType: 'display-only',
    });
    expect(spec).not.toContain('**Loading**');
    expect(spec).not.toContain('**Offline**');
  });

  it('external-data app: includes Loading and Offline states', () => {
    const spec = generateSpec(standardAnswers);
    expect(spec).toContain('**Loading**');
    expect(spec).toContain('**Offline**');
  });

  it('static minimal-tier app: omits Loading and Offline', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).not.toContain('**Loading**');
    expect(spec).not.toContain('**Offline**');
  });

  // Issue 3: Context-aware Empty state prompts
  it('weather API: generates location-specific prompt', () => {
    const spec = generateSpec({
      ...standardAnswers,
      apiDescription: 'Current weather and forecast for a location',
    });
    expect(spec).toContain('Prompt user for location');
    expect(spec).toContain('**Empty / First Use**');
  });

  it('stock tracker API: generates ticker-specific prompt', () => {
    const spec = generateSpec({
      ...standardAnswers,
      apiDescription: 'Stock prices and market data',
    });
    expect(spec).toContain('ticker symbol');
  });

  it('news feed API: generates topic-specific prompt', () => {
    const spec = generateSpec({
      ...standardAnswers,
      apiDescription: 'News articles from various sources',
    });
    expect(spec).toContain('feed');
    expect(spec).toContain('topics');
  });

  it('unknown external-data app: uses generic prompt', () => {
    const spec = generateSpec({
      ...standardAnswers,
      apiDescription: 'Some unknown data source',
      apiKnownName: 'CustomAPI',
    });
    expect(spec).toContain('initial input');
    expect(spec).not.toContain('location');
    expect(spec).not.toContain('ticker');
  });

  // --- Localhost-first development improvements ---

  it('all specs include Development Stages section', () => {
    const minimalSpec = generateSpec(minimalAnswers);
    const standardSpec = generateSpec(standardAnswers);
    expect(minimalSpec).toContain('## Development Stages');
    expect(standardSpec).toContain('## Development Stages');
  });

  it('Development Stages shows Stage 1 (Local) with tier-appropriate run command', () => {
    const minimalSpec = generateSpec(minimalAnswers);
    const standardSpec = generateSpec(standardAnswers);
    expect(minimalSpec).toContain('### Stage 1: Local (Mock Data)');
    expect(minimalSpec).toContain('Open `index.html` in browser');
    expect(minimalSpec).not.toContain('npm run dev');
    expect(standardSpec).toContain('npm run dev');
  });

  it('Development Stages shows Stage 2 (Integration) only for specs with data dependencies', () => {
    const minimalSpec = generateSpec(minimalAnswers);
    const externalDataSpec = generateSpec(standardAnswers);
    expect(minimalSpec).not.toContain('### Stage 2: Integration');
    expect(externalDataSpec).toContain('### Stage 2: Integration');
  });

  it('Development Stages shows Stage 3 (Polish) for specs with data dependencies', () => {
    const spec = generateSpec(standardAnswers);
    expect(spec).toContain('### Stage 3: Polish');
  });

  it('weather API includes mock data template with location fields', () => {
    const spec = generateSpec({
      ...standardAnswers,
      apiDescription: 'Current weather and 7-day forecast for any location',
    });
    expect(spec).toContain('### Mock Data (for local development)');
    expect(spec).toContain('location: string');
    expect(spec).toContain('temp: number');
    expect(spec).toContain('condition: string');
  });

  it('stock API includes mock data template with ticker fields', () => {
    const spec = generateSpec({
      ...standardAnswers,
      apiDescription: 'Real-time stock prices and market data',
    });
    expect(spec).toContain('### Mock Data (for local development)');
    expect(spec).toContain('ticker: string');
    expect(spec).toContain('price: number');
  });

  it('news API includes mock data template with article fields', () => {
    const spec = generateSpec({
      ...standardAnswers,
      apiDescription: 'Latest news articles and headlines',
    });
    expect(spec).toContain('### Mock Data (for local development)');
    expect(spec).toContain('title: string');
    expect(spec).toContain('description: string');
    expect(spec).toContain('publishedAt: string');
  });

  it('external-data specs include Local Development Checklist', () => {
    const spec = generateSpec(standardAnswers);
    expect(spec).toContain('Before integrating external services');
    expect(spec).toContain('App builds and runs locally with mock/fixture data');
    expect(spec).toContain('All UX states testable with mock data');
  });

  it('specs without external data omit Local Development Checklist', () => {
    const spec = generateSpec(minimalAnswers);
    expect(spec).not.toContain('Before integrating external services');
  });

  it('user-saves-data specs include Local Development Checklist', () => {
    const spec = generateSpec(userContentSavesDataAnswers);
    expect(spec).toContain('Before integrating external services');
  });

  it('display-only user-content specs omit Local Development Checklist', () => {
    const spec = generateSpec({
      ...minimalAnswers,
      dataSource: 'user-content',
      userInputType: 'display-only',
    });
    expect(spec).not.toContain('Before integrating external services');
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

  it('strips unicode from title', () => {
    expect(generateFilename({ title: 'Café Tracker' })).toBe('caf-tracker-gist-spec-v1.0.md');
  });
});

describe('extractSuggestedPrompt', () => {
  it('extracts prompt from a generated spec', () => {
    const spec = generateSpec(minimalAnswers);
    const prompt = extractSuggestedPrompt(spec);
    expect(prompt).toContain('Here is my app specification');
    expect(prompt).not.toBe('See the "Suggested Prompt" section in your spec.');
  });

  it('returns fallback when section is missing', () => {
    expect(extractSuggestedPrompt('# No prompt here')).toBe(
      'See the "Suggested Prompt" section in your spec.',
    );
  });
});
