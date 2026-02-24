import type { UserAnswers, ComplexityTier, SpecMeta } from './types';
import {
  determineComplexity,
  tierDescriptions,
  needsWorkerProxy,
  needsCron,
  shouldRecommendPWA,
} from './complexity';

const GIST_VERSION = '1.0';

/** Generate a complete markdown spec from user answers */
export function generateSpec(answers: Partial<UserAnswers>): string {
  const tier = determineComplexity(answers);
  const meta: SpecMeta = {
    gistVersion: GIST_VERSION,
    generated: new Date().toISOString().split('T')[0],
    persona: answers.persona ?? 'developer',
    complexityTier: tier,
  };

  const sections: string[] = [];

  sections.push(sectionTitle(answers));
  sections.push(sectionMeta(meta));
  sections.push(sectionSummary(answers, tier));
  sections.push(sectionIdea(answers));
  sections.push(sectionCustomizations(answers));
  sections.push(sectionArchitecture(answers, tier));
  sections.push(sectionConfigChecklist(answers, tier));
  sections.push(sectionDesign(answers, tier));
  sections.push(sectionUXStates(answers));
  sections.push(sectionWiringGuide(answers, tier));
  sections.push(sectionWebStandards(answers, tier));
  sections.push(sectionCSP(answers));
  sections.push(sectionAccessibility(answers));
  sections.push(sectionLocale());
  sections.push(sectionBudgetMath(answers, tier));

  if (hasResearchNotes(answers)) {
    sections.push(sectionResearchNotes(answers));
  }

  sections.push(sectionImplementationOrder(answers, tier));
  sections.push(sectionDevelopmentStages(answers));
  sections.push(sectionDeployment(answers, tier));
  sections.push(sectionPostDeployment(answers));
  sections.push(sectionSuggestedPrompt(answers, tier));
  sections.push(sectionFooter(meta));

  return sections.filter(Boolean).join('\n\n');
}

/** Extract the suggested prompt text from a generated spec.
 *  Returns the quoted prompt body, or a fallback message if the section isn't found. */
export function extractSuggestedPrompt(spec: string): string {
  const match = spec.match(/## Suggested Prompt\n[\s\S]*?\n\n"([\s\S]*?)"/);
  return match ? match[1] : 'See the "Suggested Prompt" section in your spec.';
}

/** Generate the kebab-case filename */
export function generateFilename(answers: Partial<UserAnswers>): string {
  const title = answers.title ? sanitizeLine(answers.title) : 'my-app';
  const kebab = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${kebab}-gist-spec-v${GIST_VERSION}.md`;
}

// --- Sanitization ---

/** Collapse newlines/tabs to spaces and trim — for single-line fields (title, apiKnownName). */
function sanitizeLine(text: string): string {
  return text.replace(/[\r\n\t]+/g, ' ').trim();
}

/** Preserve user text but escape leading markdown-structural chars (# and >) that would
 *  break spec heading/blockquote structure — for multi-line fields (description, apiDescription, stackCustomizations). */
function sanitizeBlock(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^(\s*)(#{1,6}\s|>)/, '$1\\$2'))
    .join('\n')
    .trim();
}

// --- Helpers ---

function resolveDataSource(a: Partial<UserAnswers>): string | undefined {
  return a.dataSource === 'unsure' ? 'no-external' : a.dataSource;
}

function resolveDataFreshness(a: Partial<UserAnswers>): string | undefined {
  return a.dataFreshness === 'unsure' ? 'daily' : a.dataFreshness;
}

function resolveDeviceTarget(a: Partial<UserAnswers>): string | undefined {
  return a.deviceTarget === 'unsure' ? 'both' : a.deviceTarget;
}

/** Checks external data using resolved source ('unsure' → 'no-external') because
 *  the spec generator needs resolved values. The questions.ts version intentionally
 *  checks raw answers to control conditional question visibility. */
function hasResolvedExternalData(a: Partial<UserAnswers>): boolean {
  const src = resolveDataSource(a);
  return src === 'public-api' || src === 'rss' || src === 'static-file' || src === 'other';
}

function hasResolvedUserContent(a: Partial<UserAnswers>): boolean {
  return a.dataSource === 'user-content';
}

function hasResearchNotes(a: Partial<UserAnswers>): boolean {
  return hasResolvedExternalData(a) || a.hosting === 'unsure' || a.scale === 'unsure';
}

function hostingName(a: Partial<UserAnswers>): string {
  const map: Record<string, string> = {
    'cloudflare-pages': 'Cloudflare Pages',
    'github-pages': 'GitHub Pages',
    vercel: 'Vercel',
    netlify: 'Netlify',
    unsure: 'Cloudflare Pages (recommended)',
  };
  return map[a.hosting ?? 'unsure'] ?? 'Cloudflare Pages';
}

function vibeName(a: Partial<UserAnswers>): string {
  const map: Record<string, string> = {
    calm: 'Calm and minimal',
    bold: 'Bold and vibrant',
    professional: 'Professional and clean',
    playful: 'Playful and fun',
  };
  if (a.designVibe === 'other' && a.designVibeCustom) return a.designVibeCustom;
  return map[a.designVibe ?? 'calm'] ?? 'Calm and minimal';
}

function densityName(a: Partial<UserAnswers>): string {
  const map: Record<string, string> = {
    hero: 'Hero focus (one big thing, glanceable)',
    organized: 'Organized (cards, sections, clear structure)',
    dense: 'Data-rich (dashboard, tables)',
  };
  return map[a.infoDensity ?? 'organized'] ?? 'Organized';
}

function frameworkForTier(tier: ComplexityTier): string {
  if (tier === 'minimal') return 'None — plain HTML/CSS/JS';
  return 'Astro (static site generator)';
}

/** Generate context-aware empty state prompt text based on API description or known name.
 *  Falls back to generic text if no API context is available. */
function generateEmptyStatePrompt(apiDescription?: string, apiKnownName?: string): string {
  if (!apiDescription) {
    return '- **Empty / First Use** — Prompt user for initial input. Clear call to action.';
  }

  const desc = apiDescription.toLowerCase();

  // Pattern matching for common API types
  if (
    desc.includes('location') ||
    desc.includes('weather') ||
    desc.includes('city') ||
    desc.includes('address')
  ) {
    return '- **Empty / First Use** — Prompt user for location (city, zip, or coordinates). Clear call to action.';
  }
  if (
    desc.includes('stock') ||
    desc.includes('ticker') ||
    desc.includes('price') ||
    desc.includes('market')
  ) {
    return '- **Empty / First Use** — Prompt user for ticker symbol or company name. Clear call to action.';
  }
  if (
    desc.includes('search') ||
    desc.includes('query') ||
    desc.includes('keyword') ||
    desc.includes('term')
  ) {
    return '- **Empty / First Use** — Prompt user for search query. Clear call to action.';
  }
  if (
    desc.includes('news') ||
    desc.includes('feed') ||
    desc.includes('article') ||
    desc.includes('rss')
  ) {
    return '- **Empty / First Use** — Load initial feed or prompt user to select topics. Clear call to action.';
  }
  if (desc.includes('currency') || desc.includes('convert')) {
    return '- **Empty / First Use** — Prompt user for amounts and currency pairs. Clear call to action.';
  }

  // Check known API names
  if (apiKnownName) {
    const knownName = apiKnownName.toLowerCase();
    if (
      knownName.includes('weather') ||
      knownName.includes('openweather') ||
      knownName.includes('open-meteo')
    ) {
      return '- **Empty / First Use** — Prompt user for location. Clear call to action.';
    }
    if (knownName.includes('crypto') || knownName.includes('coinbase')) {
      return '- **Empty / First Use** — Prompt user for cryptocurrencies to track. Clear call to action.';
    }
  }

  // Fallback to generic
  return '- **Empty / First Use** — Prompt user for initial input. Clear call to action.';
}

// --- Section builders ---

function sectionTitle(a: Partial<UserAnswers>): string {
  const title = a.title ? sanitizeLine(a.title) : 'My App';
  return `# ${title} — Gist Specification`;
}

function sectionMeta(meta: SpecMeta): string {
  return [
    '## Meta',
    `- Gist version: ${meta.gistVersion}`,
    `- Generated: ${meta.generated}`,
    `- Persona: ${meta.persona}`,
    `- Complexity tier: ${meta.complexityTier}`,
  ].join('\n');
}

function sectionSummary(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const tierInfo = tierDescriptions[tier];
  const parts: string[] = [];

  const purpose = a.headlineValue
    ? sanitizeLine(a.headlineValue)
    : a.description
      ? sanitizeBlock(a.description)
      : 'A web application.';
  parts.push(`> ${purpose}`);

  if (hasResolvedExternalData(a) && a.apiKnownName) {
    parts.push(`> Uses ${sanitizeLine(a.apiKnownName)} for data.`);
  }

  if (needsWorkerProxy(a)) {
    parts.push('> API proxied through a server-side Worker to keep keys private.');
  }

  parts.push(`> ${tierInfo.framework}. Hosted on ${hostingName(a)}.`);

  parts.push('');
  parts.push(
    '> **For AI assistants:** Follow the Implementation Order step by step. If any requirement is ambiguous, ask the user — do not assume. Verify the design with the user after rendering mock data before connecting real data.',
  );

  if (a.persona === 'new-builder') {
    parts.push('');
    parts.push(
      '> **For you:** This spec is your blueprint — your AI assistant will handle the technical details. Read through it to see what your app will include, then share the whole thing with your AI coding assistant.',
    );
  }

  return `## Summary\n${parts.join('\n')}`;
}

function sectionIdea(a: Partial<UserAnswers>): string {
  const lines = [
    '## Idea',
    `- Title: ${a.title ? sanitizeLine(a.title) : 'Untitled'}`,
    `- Description: ${a.description ? sanitizeBlock(a.description) : ''}`,
  ];

  if (a.audience) lines.push(`- Audience: ${a.audience}`);
  if (a.usageFrequency) {
    const deviceLabel = a.deviceTarget === 'unsure' ? 'both (default)' : a.deviceTarget;
    lines.push(`- Usage pattern: ${a.usageFrequency}${deviceLabel ? `, ${deviceLabel}` : ''}`);
  }
  if (a.headlineValue) lines.push(`- Headline value: ${a.headlineValue}`);
  if (a.pageCount === 'unsure') {
    lines.push('- Page count: single (default — you selected "I\'m not sure")');
  }
  if (a.dataSource === 'unsure') {
    lines.push(
      '- Data source: none assumed (you selected "I\'m not sure" — the spec keeps things flexible)',
    );
  }

  return lines.join('\n');
}

function sectionArchitecture(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines: string[] = ['## Architecture'];

  // Data & Caching (conditional)
  if (hasResolvedExternalData(a)) {
    lines.push('');
    lines.push('### Data & Caching');

    if (a.apiKnownName) {
      lines.push(`- Data source: ${sanitizeLine(a.apiKnownName)}`);
    } else if (a.apiDescription) {
      lines.push(`- Data source: ${sanitizeBlock(a.apiDescription)}`);
    }

    if (a.dataFreshness) {
      const freshnessMap: Record<string, string> = {
        realtime: 'Real-time (fetch on each request)',
        hourly: 'Hourly (cron job + cache)',
        daily: 'Daily or less (bake into build or cache with long TTL)',
        static: 'Static (fetch once, cache indefinitely)',
        unsure: 'Daily or less (safe default — bake into build or cache with long TTL)',
      };
      lines.push(`- Update frequency: ${freshnessMap[a.dataFreshness]}`);
      if (a.dataFreshness === 'unsure') {
        lines.push(
          '  - > *You selected "I\'m not sure" — we defaulted to daily updates. This is the safest choice: low API usage, simple caching, easy to change later.*',
        );
      }
    }

    if (needsCron(a)) {
      lines.push(
        '- Caching strategy: Cron job updates cache hourly. Frontend reads from cache (fast, no API key exposed).',
      );
    } else if (needsWorkerProxy(a)) {
      lines.push(
        '- Caching strategy: Worker proxies API calls. Consider adding cache headers for repeat requests.',
      );
    }
  }

  // Infrastructure (always)
  lines.push('');
  lines.push('### Infrastructure');
  lines.push(`- Host: ${hostingName(a)}`);
  lines.push(`- Framework: ${frameworkForTier(tier)}`);

  if (tier === 'full') {
    lines.push('- Cache: Cloudflare KV (stores cached API responses)');
    lines.push('- Proxy: Cloudflare Worker (API proxy + cache writer)');
    lines.push('- CI: GitHub Actions (deploy + hourly cron)');
  } else if (tier === 'standard' && needsWorkerProxy(a)) {
    lines.push('- Proxy: Cloudflare Worker (API proxy)');
    lines.push('- CI: GitHub Actions (deploy)');
  } else {
    lines.push('- Proxy: None needed');
    if (tier === 'standard') {
      lines.push('- CI: GitHub Actions (deploy)');
    } else {
      lines.push('- CI: None needed (push to deploy)');
    }
  }

  // APIs to Integrate (conditional)
  if (hasResolvedExternalData(a) && (a.apiDescription || a.apiKnownName)) {
    lines.push('');
    lines.push('### APIs to Integrate');

    if (a.apiKnownName) {
      lines.push(`- **${sanitizeLine(a.apiKnownName)}**`);
    }

    if (a.apiDescription) {
      lines.push(`  - Data needed: ${sanitizeBlock(a.apiDescription)}`);
    }

    const proxyNeeded = needsWorkerProxy(a);
    lines.push(
      `  - CORS from browser: ${proxyNeeded ? 'Verify — may need Worker proxy' : 'Verify availability'}`,
    );

    if (proxyNeeded) {
      lines.push(
        '  - **Action: Research this API. Determine: free tier limits, auth requirements, CORS support. If API key required, route through Worker proxy — never expose in frontend.**',
      );
    } else {
      lines.push(
        '  - **Action: Research this API. Determine: free tier limits, auth requirements, CORS support, rate limits.**',
      );
    }
  }

  // Lightweight Libraries — tinyrouter for minimal tier (Astro has built-in routing),
  // indexed-cache for non-minimal tiers with cacheable external data
  const libs: string[] = [];
  if (tier === 'minimal' && (a.pageCount === 'many' || a.pageCount === 'few')) {
    libs.push(
      '- [tinyrouter.js](https://github.com/knadh/tinyrouter.js) (~950 B) — Frontend routing for multi-page navigation',
    );
  }
  if (
    tier !== 'minimal' &&
    hasResolvedExternalData(a) &&
    (a.dataFreshness === 'hourly' || a.dataFreshness === 'daily')
  ) {
    libs.push(
      '- [indexed-cache.js](https://github.com/nicedoc/indexed-cache) (~2.1 KB) — IndexedDB caching for offline-friendly data',
    );
  }
  if (libs.length > 0) {
    lines.push('');
    lines.push('### Recommended Lightweight Libraries');
    lines.push(
      '> From [oat.ink/other-libs](https://oat.ink/other-libs/) — tiny, zero-dependency libraries.',
    );
    lines.push(...libs);
  }

  // Observability (standard/full tier)
  if (tier !== 'minimal') {
    lines.push('');
    lines.push('### Observability');
    if (needsWorkerProxy(a) || tier === 'full') {
      lines.push(
        '- Health endpoint: Add a `/health` route to your Worker returning `ok` (for uptime monitoring).',
      );
    }
    if (needsWorkerProxy(a)) {
      lines.push(
        '- Analytics: Hosting provider analytics cover page views. For funnel tracking (sign-up → action → conversion), add custom events via `navigator.sendBeacon()` to a Worker endpoint.',
      );
    } else {
      lines.push(
        '- Analytics: Hosting provider analytics cover page views. For funnel tracking (sign-up → action → conversion), consider integrating a lightweight analytics service.',
      );
    }
    lines.push(
      '- Errors: Log to `console.error()` with context. For production visibility, consider a free error tracker (Sentry free tier: 5K events/month).',
    );
  }

  // User Input & Storage (conditional)
  if (hasResolvedUserContent(a)) {
    lines.push('');
    lines.push('### User Input & Storage');

    if (a.userInputType === 'simple-form') {
      lines.push('- Type: Simple form submission (contact, feedback, newsletter)');
      lines.push('- Storage: Consider Cloudflare Workers KV, Formspree, or Netlify Forms');
      lines.push(
        '- Validation: Client-side + server-side. Sanitize all input. CSRF protection if using custom backend.',
      );
    } else if (a.userInputType === 'user-saves-data') {
      lines.push('- Type: Users create and save data (accounts, preferences, entries)');
      lines.push(
        '- Storage: Requires a database. Consider Cloudflare D1 (SQLite), Supabase, or Firebase.',
      );
      lines.push(
        '- **Note: This significantly increases complexity. Consider whether the MVP can launch with simpler storage (localStorage, KV) and upgrade later.**',
      );
    } else {
      lines.push('- Type: Display only — content is pre-loaded, users view it');
      lines.push('- No user input handling needed');
    }
  }

  return lines.join('\n');
}

function sectionDesign(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = [
    '## Design Decisions',
    `- Vibe: ${vibeName(a)}`,
    `- Information density: ${densityName(a)}`,
    '- Fonts: system-ui stack (fast loading, native feel)',
    '- Theme: Respect OS dark/light mode via `prefers-color-scheme`',
    '- Design tokens in `:root` custom properties',
    `- CSS: ${tier === 'minimal' ? 'Consider' : 'For simple pages, consider'} [oat](https://oat.ink/) — ultra-lightweight CSS+JS that styles semantic HTML without classes (\`<1.5 KB\`)`,
  ];

  return lines.join('\n');
}

function sectionUXStates(a: Partial<UserAnswers>): string {
  const lines = ['## UX States', ''];

  // Loading state: only for apps that fetch or save data
  if (
    hasResolvedExternalData(a) ||
    (hasResolvedUserContent(a) && a.userInputType !== 'display-only')
  ) {
    lines.push(
      '- **Loading** — Show loading indicator or skeleton while data loads. Show immediately on interaction.',
    );
  }

  if (hasResolvedExternalData(a)) {
    lines.push(generateEmptyStatePrompt(a.apiDescription, a.apiKnownName));
    lines.push(
      '- **Error (API)** — Friendly error message with "Try again" button. Never a dead end.',
    );
    lines.push('- **Error (Network)** — "Check your connection" message with retry option.');
  }

  lines.push(
    '- **Success** — Primary content displayed. Clean, focused layout matching the design vibe.',
  );

  if (hasResolvedExternalData(a) && needsCron(a)) {
    lines.push(
      '- **Stale data** — If cached data is old, show warning: "Data may be outdated. Last updated: [time]."',
    );
  }

  if (hasResolvedUserContent(a)) {
    if (a.userInputType !== 'display-only') {
      lines.push(
        '- **Empty / First Use** — No saved data yet. Show clear call to action to create first entry.',
      );
    }
    if (a.userInputType === 'user-saves-data') {
      lines.push(
        '- **Error (Storage)** — Save failed. Show inline error with retry option. Keep form populated — never lose user input.',
      );
    }
    lines.push(
      "- **Form validation** — Inline validation with helpful messages. Don't block submission for optional fields.",
    );
  }

  // Offline state: only for apps that fetch external data
  if (hasResolvedExternalData(a)) {
    lines.push(
      '- **Offline** — Show appropriate message. If PWA with cache, show last-known data.',
    );
  }

  lines.push('');
  lines.push('### Show/Hide Pattern');
  lines.push(
    '- Use the `hidden` attribute for toggling visibility (`element.hidden = true/false`).',
  );
  lines.push(
    '- **Gotcha:** If CSS sets `display: flex` or `display: grid` on the element, it overrides `hidden`. Fix: use `.my-class:not([hidden]) { display: flex; }` instead.',
  );
  lines.push(
    '- Disabled controls should explain why — use `aria-describedby` pointing to a hint element.',
  );
  lines.push(
    '- Silent `catch {}` blocks should surface user-facing feedback (inline note or button text change), not fail silently.',
  );

  return lines.join('\n');
}

function sectionWiringGuide(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Wiring Guide'];

  // Only include if there's meaningful wiring
  if (tier === 'minimal' && !hasResolvedExternalData(a) && !hasResolvedUserContent(a)) {
    lines.push('');
    lines.push('### Data Flow');
    lines.push('- Static content rendered directly in HTML. No external data dependencies.');
    lines.push('');
    lines.push('### Pre-Ship Checklist (for agentic system)');
    lines.push('> **IMPORTANT: The repo may be public. Complete before deploying.**');
    appendMinimalChecklist(lines);
    return lines.join('\n');
  }

  if (hasResolvedExternalData(a) || hasResolvedUserContent(a)) {
    lines.push('');
    lines.push('### Data Flow');

    if (needsWorkerProxy(a)) {
      lines.push('1. Browser requests data from Worker endpoint');
      lines.push('2. Worker reads API key from Cloudflare secret');
      lines.push('3. Worker fetches external API');
      if (needsCron(a)) {
        lines.push('4. (Cron path) GitHub Actions triggers Worker to refresh cache hourly');
        lines.push('5. Worker writes fresh data to KV');
        lines.push('6. (Read path) Worker serves cached data from KV');
      } else {
        lines.push('4. Worker returns response to browser');
      }
      lines.push(
        `${needsCron(a) ? '7' : '5'}. Browser renders data using safe DOM methods (\`textContent\`, not \`innerHTML\`)`,
      );
    } else if (hasResolvedUserContent(a)) {
      if (a.userInputType === 'simple-form') {
        lines.push('1. User fills out form in the browser');
        lines.push('2. Browser validates input client-side');
        lines.push('3. Form submits to handler (Formspree, Netlify Forms, or Worker endpoint)');
        lines.push('4. Handler processes submission and returns confirmation');
        lines.push(
          '5. Browser shows success/error feedback using safe DOM methods (`textContent`, not `innerHTML`)',
        );
      } else if (a.userInputType === 'user-saves-data') {
        lines.push('1. User creates or edits data in the browser');
        lines.push('2. Browser validates input client-side');
        lines.push(
          '3. Data persists to storage (localStorage for MVP, or database — see Architecture > User Input & Storage)',
        );
        lines.push('4. On load, browser reads saved data from storage');
        lines.push(
          '5. Browser renders data using safe DOM methods (`textContent`, not `innerHTML`)',
        );
      } else {
        lines.push('1. Content is pre-loaded in HTML or fetched at build time');
        lines.push(
          '2. Browser renders content using safe DOM methods (`textContent`, not `innerHTML`)',
        );
      }
    } else {
      lines.push('1. Browser fetches data directly from API (no key needed, CORS-friendly)');
      lines.push('2. Browser renders data using safe DOM methods (`textContent`, not `innerHTML`)');
    }

    // Mock data template for external APIs
    if (hasResolvedExternalData(a)) {
      lines.push('');
      lines.push(generateMockDataTemplate(a.apiDescription, a.apiKnownName));
    }
  }

  // Trust Boundary
  if (needsWorkerProxy(a) || hasResolvedUserContent(a)) {
    lines.push('');
    lines.push('### Trust Boundary');
    lines.push('- Browser (public): renders UI, fetches from Worker or public APIs');

    if (needsWorkerProxy(a)) {
      lines.push('- Worker (private): holds API keys, proxies requests, reads/writes cache');
      lines.push(
        '- **Never expose:** API keys must not appear in frontend JS, HTML, config, or git history',
      );
    }

    if (needsCron(a)) {
      lines.push('- GitHub Actions (private): holds secrets for cron trigger authorization');
    }
  }

  // Secret Configuration
  if (needsWorkerProxy(a)) {
    lines.push('');
    lines.push('### Secret Configuration');
    lines.push('| Secret | Platform | How to Set | Used By |');
    lines.push('|---|---|---|---|');
    lines.push(
      '| API key | Cloudflare Worker | `npx wrangler secret put API_KEY` | Worker (API fetch) |',
    );

    if (needsCron(a)) {
      lines.push('| API key | GitHub Actions | Settings > Secrets > Actions | Cron workflow |');
      lines.push(
        '| `CF_API_TOKEN` | GitHub Actions | Settings > Secrets > Actions | Cron trigger auth |',
      );
    }
  }

  // Pre-Ship Checklist
  lines.push('');
  lines.push('### Pre-Ship Checklist (for agentic system)');
  lines.push('> **IMPORTANT: The repo may be public. Complete before deploying.**');

  // Local Development Checklist (before wiring real APIs)
  if (
    hasResolvedExternalData(a) ||
    (hasResolvedUserContent(a) && a.userInputType !== 'display-only')
  ) {
    lines.push('');
    lines.push('**Before integrating external services:**');
    lines.push(
      '- [ ] App builds and runs locally with mock/fixture data (`npm run dev` works immediately)',
    );
    lines.push('- [ ] All UX states testable with mock data: loading, error, empty, success');
    lines.push('- [ ] UI approved by user (show mock data before wiring real API)');
    lines.push('- [ ] Data shape verified (mock matches real API response structure)');
  }

  if (needsWorkerProxy(a)) {
    lines.push('');
    lines.push('**Security:**');
    lines.push(
      '- [ ] `git log -p | grep -i` for: API_KEY, SECRET, TOKEN, PASSWORD — must find zero matches',
    );
    lines.push('- [ ] Search `dist/` build output for API key strings — must find zero matches');
    lines.push('- [ ] Verify no secrets in any committed file');
    lines.push('- [ ] Verify Worker does not echo API key in responses or error messages');
    lines.push('- [ ] Verify `.env`, `.env.*`, `*.local` are in `.gitignore`');
    lines.push('- [ ] Verify app starts correctly with empty `.env` — secrets come from platform');
  }

  appendMinimalChecklist(lines);

  if (shouldRecommendPWA(a)) {
    lines.push(
      '- [ ] Service worker cache version bumped (must update on every release to invalidate stale assets)',
    );
  }

  return lines.join('\n');
}

function appendMinimalChecklist(lines: string[]): void {
  lines.push('');
  lines.push('**Web standards:**');
  lines.push('- [ ] No `innerHTML` with dynamic data — use `textContent` or safe DOM methods');
  lines.push('- [ ] Error messages do not leak paths, keys, or stack traces');
  lines.push('- [ ] HTML passes W3C validation');
  lines.push('- [ ] Semantic HTML used (`<header>`, `<main>`, `<section>`, `<footer>`)');
  lines.push('- [ ] CSS and JS externalized');
  lines.push('- [ ] Favicon present (SVG preferred)');
  lines.push('- [ ] og:image present (1200x630)');
  lines.push('- [ ] `robots.txt` at root');
  lines.push('- [ ] `<meta name="description">` set');
  lines.push('- [ ] `<html lang="en">` set');
  lines.push('- [ ] Keyboard navigation works for all interactive elements');
  lines.push('- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 large)');
  lines.push('- [ ] Touch targets minimum 44x44px');
  lines.push('- [ ] `prefers-color-scheme` dark/light works');
  lines.push('- [ ] `prefers-reduced-motion` respected');
  lines.push('- [ ] Lighthouse: target 90+ on all categories');
  lines.push('- [ ] Mobile viewport test (320px minimum)');
  lines.push('');
  lines.push('**Release readiness:**');
  lines.push('- [ ] Version bumped in package.json (if applicable)');
  lines.push('- [ ] CHANGELOG.md updated ([Keep a Changelog](https://keepachangelog.com/) format)');
  lines.push('- [ ] No cosmetic delays longer than 500ms without justification');
  lines.push('- [ ] No silent `catch {}` blocks — all failures surface user-facing feedback');
  lines.push('- [ ] Disabled buttons have `aria-describedby` or `title` explaining why');
}

function sectionWebStandards(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Web Standards', ''];

  lines.push('### Required Files');
  lines.push('| File | Content |');
  lines.push('|---|---|');

  if (tier === 'minimal') {
    lines.push('| `index.html` | Semantic HTML, full `<head>` with meta tags |');
    lines.push('| `style.css` | Externalized styles, `:root` tokens, responsive, dark mode |');
    lines.push('| `app.js` | Application logic (`<script defer>`) |');
  } else {
    lines.push('| `src/` | Astro pages and components |');
    lines.push('| `astro.config.mjs` | Astro configuration |');
  }

  lines.push('| `favicon.svg` | App icon, dark-mode aware SVG |');
  lines.push('| `og-image.png` | 1200x630: app title on branded gradient |');
  lines.push('| `robots.txt` | `User-agent: * Allow: /` |');
  lines.push('| `.gitignore` | `.env`, `.env.*`, `*.local`, `node_modules/`, `dist/` |');
  lines.push('| `404.html` | Custom 404 page with navigation back to home |');
  lines.push(
    '| `humans.txt` | Credits: team, tools, site info ([humanstxt.org](http://humanstxt.org/)) |',
  );

  if (needsWorkerProxy(a)) {
    lines.push('| `.env.example` | Placeholder for API keys (never real values) |');
    lines.push('| `wrangler.toml` | Worker config (no secrets — set via CLI) |');
  }

  if (tier !== 'minimal') {
    lines.push('| `sitemap.xml` | List of pages |');
  }

  lines.push('');
  lines.push('> These files are created during the Scaffold step of the Implementation Order.');
  lines.push('');
  lines.push('### Performance Defaults');
  lines.push('- `<script defer>` on all JS (non-blocking load)');
  lines.push('- `loading="lazy"` on all images below the fold');
  lines.push('- Explicit `width` and `height` on all `<img>` elements (prevents layout shift)');

  return lines.join('\n');
}

function sectionAccessibility(a: Partial<UserAnswers>): string {
  const lines = [
    '## Accessibility & Responsive',
    '- Keyboard navigation: all interactive elements reachable via Tab',
    '- Focus states: visible focus ring on all interactive elements',
    '- Screen reader: semantic HTML + `aria-label` on icon-only buttons',
    '- Color contrast: WCAG AA (4.5:1 minimum for text)',
    '- `prefers-reduced-motion`: disable transitions and animations',
    '- `prefers-color-scheme`: full dark/light theme',
    '- Touch targets: 44x44px minimum',
    '- Responsive: mobile-first CSS, works from 320px up',
  ];

  const device = resolveDeviceTarget(a);
  if (device === 'phone' || device === 'both') {
    lines.push('- Mobile-first layout with comfortable touch spacing');
  }
  if (a.deviceTarget === 'unsure') {
    lines.push(
      '  - > *You selected "I\'m not sure" — we defaulted to supporting both phone and desktop.*',
    );
  }

  return lines.join('\n');
}

function sectionConfigChecklist(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Configuration Checklist'];
  const host = hostingName(a);

  lines.push(`- [ ] ${host} account created (free tier)`);
  lines.push('- [ ] GitHub repo created (can be public — no secrets in code)');

  if (needsWorkerProxy(a)) {
    lines.push('- [ ] API key obtained from provider');
    lines.push('- [ ] Cloudflare Worker deployed via `npx wrangler deploy`');
    lines.push('- [ ] Worker secret set: `npx wrangler secret put API_KEY`');
  }

  if (tier === 'full') {
    lines.push('- [ ] KV namespace created in Cloudflare dashboard');
    lines.push('- [ ] KV bound to Worker in `wrangler.toml`');
    lines.push('- [ ] GitHub Actions secrets configured');
    lines.push('- [ ] Cron workflow committed and verified');
  }

  if (tier === 'minimal') {
    lines.push(`- [ ] ${host} connected to GitHub repo`);
    lines.push('- [ ] Build: (none — static files)');
    lines.push('- [ ] Output: `/` (root of repo)');
  } else {
    lines.push(`- [ ] ${host} connected to GitHub repo`);
    lines.push('- [ ] Build command: `npm run build`');
    lines.push('- [ ] Output directory: `dist/`');
  }

  lines.push('- [ ] Verify: deployment succeeds on push');

  return lines.join('\n');
}

function sectionResearchNotes(a: Partial<UserAnswers>): string {
  const lines = ['## Agentic Research Notes', '> **For your AI coding assistant:**', '>'];

  if (hasResolvedExternalData(a)) {
    if (a.apiKnownName) {
      lines.push(`> **${sanitizeLine(a.apiKnownName)} verification:**`);
      lines.push('> - Confirm free tier limits and rate limits');
      lines.push('> - Confirm auth requirements (API key? OAuth? None?)');
      lines.push('> - Confirm CORS support for browser-side requests');

      if (a.apiDescription) {
        lines.push(
          `> - Verify these data fields are available: ${sanitizeBlock(a.apiDescription)}`,
        );
      }

      lines.push(
        '> - If API key is required, route through Worker proxy — never expose in frontend',
      );
    } else if (a.apiDescription) {
      lines.push('> **API research needed:**');
      lines.push(`> - User needs: ${sanitizeBlock(a.apiDescription)}`);
      lines.push(
        '> - Research suitable APIs. Evaluate: free tier limits, auth requirements, CORS support, data quality',
      );
      lines.push('> - Prefer APIs with generous free tiers and no API key requirement');
      lines.push('> - If API key is required, plan for Worker proxy');
    }
  }

  if (a.hosting === 'unsure') {
    lines.push('>');
    lines.push('> **Hosting recommendation:**');
    lines.push(
      '> - Cloudflare Pages: Unlimited builds, global CDN, atomic deploys, Workers integration',
    );
    lines.push('> - GitHub Pages: Simplest setup, great for static sites');
    lines.push('> - Vercel: Great developer experience, 100 GB bandwidth/month');
    lines.push('> - Netlify: Form handling built in, 100 GB bandwidth/month');
    lines.push("> - Recommend based on the app's needs (Worker integration? Forms? Simplicity?)");
  }

  if (shouldRecommendPWA(a)) {
    lines.push('>');
    lines.push('> **PWA consideration:**');
    lines.push('> - This is a daily mobile app — strong PWA candidate');
    lines.push('> - Minimum: `manifest.json` with name, icons, theme_color, display: standalone');
    lines.push('> - Nice-to-have: service worker for offline caching of last-known data');
  }

  return lines.join('\n');
}

function sectionCustomizations(a: Partial<UserAnswers>): string {
  if (!a.stackCustomizations) return '';
  return [
    '## User Customization Notes',
    `> The user requested the following customizations. Incorporate these preferences where possible:`,
    `> ${sanitizeBlock(a.stackCustomizations)}`,
  ].join('\n');
}

function sectionCSP(a: Partial<UserAnswers>): string {
  const lines = ['## Content Security Policy'];
  lines.push('');
  lines.push('Add this `<meta>` tag to your `<head>`:');
  lines.push('');

  const connectSrc = needsWorkerProxy(a)
    ? "'self'"
    : hasResolvedExternalData(a)
      ? "'self' https:"
      : hasResolvedUserContent(a) &&
          (a.userInputType === 'simple-form' || a.userInputType === 'user-saves-data')
        ? "'self' https:"
        : "'self'";

  lines.push('```html');
  lines.push('<meta http-equiv="Content-Security-Policy" content="');
  lines.push(`  default-src 'self';`);
  lines.push(`  style-src 'self' 'unsafe-inline';`);
  lines.push(`  img-src 'self' data:;`);
  lines.push(`  connect-src ${connectSrc};`);
  lines.push('">');
  lines.push('```');
  lines.push('');
  lines.push(
    "> Tighten `connect-src` after you know exact API domains (e.g., `connect-src 'self' https://api.example.com`).",
  );

  if (hasResolvedUserContent(a) && a.userInputType === 'simple-form') {
    lines.push(
      '> If using an external form handler (Formspree, Netlify Forms), tighten `connect-src` to its specific domain and add `form-action` directive.',
    );
  }

  if (hasResolvedUserContent(a) && a.userInputType === 'user-saves-data') {
    lines.push(
      '> Tighten `connect-src` to your database provider domain (e.g., `https://*.supabase.co`) before deploying.',
    );
  }

  return lines.join('\n');
}

function sectionLocale(): string {
  return [
    '## Locale & Internationalization',
    '- `<html lang="en">` on the root element',
    '- Use `Intl.DateTimeFormat()` for all date/time formatting',
    '- Use `Intl.NumberFormat()` for all number formatting',
    '- Default to metric units where applicable',
    '- Never concatenate translated strings — use template literals or `Intl.MessageFormat` patterns',
  ].join('\n');
}

function sectionBudgetMath(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  if (!hasResolvedExternalData(a) && a.scale !== 'public' && a.userInputType !== 'user-saves-data')
    return '';

  const freshness = resolveDataFreshness(a);
  const lines = ['## Free Tier Budget'];

  lines.push('');
  lines.push('| Resource | Free Tier Limit | Estimated Usage |');
  lines.push('|---|---|---|');

  // Hosting bandwidth
  const hosting = a.hosting ?? 'unsure';
  if (hosting === 'cloudflare-pages' || hosting === 'unsure') {
    lines.push('| Cloudflare Pages bandwidth | Unlimited | N/A |');
    lines.push('| Cloudflare Pages builds | 500/month | ~30 (1/day with CI) |');
  } else if (hosting === 'vercel' || hosting === 'netlify') {
    lines.push(`| ${hostingName(a)} bandwidth | 100 GB/month | Well under limit for most apps |`);
  } else if (hosting === 'github-pages') {
    lines.push('| GitHub Pages bandwidth | 100 GB/month | Well under limit for most apps |');
  }

  // API calls
  if (hasResolvedExternalData(a)) {
    let apiEstimate = 'Varies';
    if (freshness === 'realtime') apiEstimate = 'Up to rate limit (varies by provider)';
    else if (freshness === 'hourly') apiEstimate = '~720/month';
    else if (freshness === 'daily' || freshness === 'static') apiEstimate = '~30/month';
    lines.push(`| API calls | Varies by provider | ${apiEstimate} |`);
  }

  // KV for full tier
  if (tier === 'full') {
    lines.push('| Cloudflare KV reads | 100K/day | Well under limit |');
    lines.push('| Cloudflare KV writes | 1K/day | ~24 (hourly cron) |');
  }

  // Database for user-saves-data
  if (a.userInputType === 'user-saves-data') {
    lines.push(
      '| Database (D1/Supabase/Firebase) | Varies (D1: 5M rows free, Supabase: 500MB free) | Depends on user base |',
    );
  }

  return lines.join('\n');
}

/** Generate mock data template based on API description.
 *  Provides a shape guide for downstream AI to generate realistic sample values. */
function generateMockDataTemplate(apiDescription?: string, apiKnownName?: string): string {
  if (!apiDescription) return '';

  const desc = apiDescription.toLowerCase();
  const lines = ['### Mock Data (for local development)', ''];
  lines.push(
    'Use this shape while building UI. Downstream AI will generate realistic sample values.',
  );
  lines.push('');

  // Weather APIs
  if (
    desc.includes('weather') ||
    desc.includes('forecast') ||
    desc.includes('temperature') ||
    apiKnownName?.toLowerCase().includes('weather')
  ) {
    lines.push('**Shape:**');
    lines.push('```javascript');
    lines.push('const mockWeather = {');
    lines.push('  location: string,      // city name');
    lines.push('  current: {');
    lines.push('    temp: number,        // degrees (F or C)');
    lines.push('    condition: string,   // weather description');
    lines.push('    icon: string         // emoji or icon code');
    lines.push('  },');
    lines.push('  forecast: [            // array of future days');
    lines.push('    { day: string, high: number, low: number, condition: string }');
    lines.push('  ]');
    lines.push('};');
    lines.push('```');
  }
  // Stock/market APIs
  else if (
    desc.includes('stock') ||
    desc.includes('price') ||
    desc.includes('market') ||
    apiKnownName?.toLowerCase().includes('stock')
  ) {
    lines.push('**Shape:**');
    lines.push('```javascript');
    lines.push('const mockStocks = [');
    lines.push('  {');
    lines.push('    ticker: string,      // symbol (e.g., "AAPL")');
    lines.push('    price: number,       // current price');
    lines.push('    change: number,      // price change');
    lines.push('    changePercent: number, // percentage change');
    lines.push('    name: string         // company name');
    lines.push('  }');
    lines.push('];');
    lines.push('```');
  }
  // News/feed APIs
  else if (desc.includes('news') || desc.includes('feed') || desc.includes('article')) {
    lines.push('**Shape:**');
    lines.push('```javascript');
    lines.push('const mockArticles = [');
    lines.push('  {');
    lines.push('    title: string,       // headline');
    lines.push('    description: string, // summary');
    lines.push('    source: string,      // news source');
    lines.push('    publishedAt: string, // ISO timestamp');
    lines.push('    url: string          // article link');
    lines.push('  }');
    lines.push('];');
    lines.push('```');
  }
  // Generic fallback
  else {
    lines.push('**Shape:**');
    lines.push('');
    lines.push('Define the expected data structure with:');
    lines.push('- Field names (e.g., `id`, `title`, `timestamp`)');
    lines.push('- Data types (string, number, array, object)');
    lines.push('- Sample values or ranges');
    lines.push('');
    lines.push('Downstream AI will generate realistic mock data matching this shape.');
  }

  lines.push('');
  lines.push(
    '**Implementation:** Load this mock data while building UI. Replace with real API fetch when ready.',
  );

  return lines.join('\n');
}

function sectionDevelopmentStages(a: Partial<UserAnswers>): string {
  const lines = ['## Development Stages', ''];
  lines.push(
    'Build locally first, integrate external services later. This lets you test the UI without dependencies.',
  );
  lines.push('');

  lines.push('### Stage 1: Local (Mock Data)');
  lines.push('- Render UI with mock/fixture data (defined in Implementation Order)');
  lines.push('- Test all UX states locally: loading, error, success, empty');
  lines.push('- No external API calls');
  lines.push('- **Run:** `npm run dev` → app works immediately on localhost');
  lines.push('');

  if (hasResolvedExternalData(a) || hasResolvedUserContent(a)) {
    lines.push('### Stage 2: Integration (Real Data)');
    lines.push('- Replace mock data with real API/database fetch');
    lines.push('- Test with actual responses (may differ from mock assumptions)');
    lines.push('- Add retry/error handling for real failure modes');
    lines.push('');

    lines.push('### Stage 3: Polish (Nice-to-Haves)');
    lines.push('- Analytics tracking');
    if (shouldRecommendPWA(a)) {
      lines.push('- Service worker for offline caching');
    }
    lines.push('- Performance optimizations');
    lines.push('- Advanced features');
  }

  return lines.join('\n');
}

function sectionImplementationOrder(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Implementation Order'];
  let step = 1;

  if (tier === 'minimal') {
    lines.push(
      `${step++}. **Scaffold** — Create \`index.html\`, \`style.css\`, \`app.js\`, \`favicon.svg\`, \`robots.txt\`, \`.gitignore\``,
    );
  } else {
    lines.push(
      `${step++}. **Scaffold** — \`npm create astro@latest\`, configure \`astro.config.mjs\`, \`.gitignore\``,
    );
  }

  lines.push(
    `${step++}. **HTML shell** — Semantic markup with all UX states (loading, error, success). No data yet.`,
  );
  lines.push(
    `${step++}. **Styles** — Design tokens, palette, dark mode, responsive layout, 44px touch targets`,
  );
  lines.push(
    `${step++}. **Mock data** — Render the UI with hardcoded data so you can approve the design`,
  );
  lines.push(
    '   > **Checkpoint:** Show the user the UI with mock data. Get design approval before connecting real data.',
  );

  if (needsWorkerProxy(a)) {
    lines.push(`${step++}. **Worker** — Create Cloudflare Worker with API proxy endpoint`);
  }

  if (hasResolvedExternalData(a)) {
    lines.push(
      `${step++}. **Connect data** — Fetch from ${needsWorkerProxy(a) ? 'Worker' : 'API'}, render real data`,
    );
    lines.push('   > **Checkpoint:** Confirm data flows correctly end-to-end before proceeding.');
  }

  if (hasResolvedUserContent(a)) {
    if (a.userInputType === 'user-saves-data') {
      lines.push(
        `${step++}. **Storage backend** — Set up persistence (localStorage for MVP, or D1/Supabase/Firebase for multi-user). Define schema and read/write operations`,
      );
      lines.push(
        `${step++}. **Connect storage** — Wire forms to storage, confirm data round-trips (create → read → update → delete)`,
      );
      lines.push('   > **Checkpoint:** Confirm data flows correctly end-to-end before proceeding.');
    } else if (a.userInputType === 'simple-form') {
      lines.push(
        `${step++}. **Form handler** — Connect form to submission endpoint (Formspree, Netlify Forms, or Worker)`,
      );
      lines.push('   > **Checkpoint:** Confirm data flows correctly end-to-end before proceeding.');
    }
  }

  if (needsCron(a)) {
    lines.push(`${step++}. **Cron** — GitHub Actions hourly trigger for cache refresh`);
  }

  lines.push(`${step++}. **Error handling** — API failures, loading states, offline fallback`);
  lines.push(
    `${step++}. **Web standards** — favicon, og:image, CSP, meta tags, robots.txt, Lighthouse audit`,
  );
  lines.push(`${step++}. **Deploy** — Push to GitHub, connect to hosting, verify deployment`);
  lines.push(
    `${step++}. **Polish** — Lighthouse 90+, accessibility audit, mobile testing, verify all UX states work. Complete the **Pre-Ship Checklist** (in Wiring Guide section) before declaring done`,
  );

  return lines.join('\n');
}

function sectionDeployment(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Deployment'];
  let step = 1;
  const host = hostingName(a);

  if (needsWorkerProxy(a)) {
    lines.push(`${step++}. **Worker:** \`npx wrangler deploy\` — verify at your Worker URL`);
    lines.push(
      `${step++}. **Worker secret:** \`npx wrangler secret put API_KEY\` — enter key when prompted`,
    );

    if (tier === 'full') {
      lines.push(
        `${step++}. **KV:** Create namespace in Cloudflare dashboard, copy ID, add to \`wrangler.toml\``,
      );
      lines.push(`${step++}. **Redeploy Worker** with KV binding: \`npx wrangler deploy\``);
    }
  }

  lines.push(`${step++}. **Push to GitHub:** \`git push origin main\``);
  lines.push(`${step++}. **${host}:** Connect repo, set build settings`);

  if (tier === 'minimal') {
    lines.push(`${step++}. **Build settings:** No build command, output directory: \`/\``);
  } else {
    lines.push(`${step++}. **Build settings:** \`npm run build\`, output: \`dist/\``);
  }

  lines.push(`${step++}. **Verify:** Visit your deployed URL, test core functionality`);

  if (needsCron(a)) {
    lines.push(`${step++}. **Cron:** Commit GitHub Actions workflow, verify it runs`);
    lines.push(`${step++}. **End-to-end:** Wait for first cron run, verify data refreshes`);
  }

  lines.push(`${step++}. **If something's wrong:** Check deployment logs and browser console`);

  return lines.join('\n');
}

function sectionPostDeployment(a: Partial<UserAnswers>): string {
  const lines = [
    '## Post-Deployment',
    '> Verify after deploying, then establish ongoing practices:',
    '',
    '- [ ] Live URL loads and core functionality works',
    `- [ ] ${hostingName(a)} analytics active (free, built-in)`,
  ];

  if (hasResolvedExternalData(a)) {
    lines.push('- [ ] Pin to API version if available — external APIs change without notice');
  }

  if (needsCron(a)) {
    lines.push('- [ ] GitHub Actions cron runs successfully — failed crons mean stale data');
  }

  lines.push('- [ ] CHANGELOG.md created ([Keep a Changelog](https://keepachangelog.com/) format)');
  lines.push('- [ ] First release tagged with semver (`git tag -a v1.0.0 -m "Initial release"`)');

  return lines.join('\n');
}

function sectionSuggestedPrompt(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const tierInfo = tierDescriptions[tier];
  const lines = [
    '## Suggested Prompt',
    '> Copy this prompt and paste it into your AI coding assistant along with this spec:',
    '',
    '"Here is my app specification generated by Gist. Please:',
    '1. Read the full spec before writing any code',
    '2. Follow the Implementation Order — pause at each checkpoint for my approval',
    '3. Complete the Pre-Ship Checklist before we deploy',
  ];

  let nextStep = 4;
  if (needsWorkerProxy(a)) {
    lines.push(`${nextStep++}. Never commit API keys — use platform secrets only`);
  }

  lines.push('');

  if (tier === 'minimal') {
    lines.push(
      `Important: this is a minimal-tier app. ${tierInfo.framework} — no frameworks, no build tools, no server-side components. Keep it simple."`,
    );
  } else if (tier === 'standard') {
    lines.push(
      `Important: this is a standard-tier app using ${tierInfo.framework}. Follow the architecture decisions in the spec."`,
    );
  } else {
    lines.push(
      `Important: this is a full-tier app with ${tierInfo.framework}. Follow the architecture exactly — caching, cron, and proxy are all needed."`,
    );
  }

  if (a.persona === 'new-builder') {
    lines.push('');
    lines.push(
      "> **Tip:** You don't need to understand every technical section — your AI assistant will. Just share this full spec and follow along as it builds your app step by step.",
    );
  }

  return lines.join('\n');
}

function sectionFooter(meta: SpecMeta): string {
  return `---\n\n**Generated by Gist v${meta.gistVersion}** | ${meta.generated}`;
}
