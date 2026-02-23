import type { UserAnswers, ComplexityTier, SpecMeta } from './types';
import { determineComplexity, tierDescriptions, needsWorkerProxy, needsCron, shouldRecommendPWA } from './complexity';

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
  sections.push(sectionArchitecture(answers, tier));
  sections.push(sectionDesign(answers));
  sections.push(sectionUXStates(answers, tier));
  sections.push(sectionWiringGuide(answers, tier));
  sections.push(sectionWebStandards(answers, tier));
  sections.push(sectionAccessibility(answers));
  sections.push(sectionConfigChecklist(answers, tier));

  if (hasResearchNotes(answers)) {
    sections.push(sectionResearchNotes(answers));
  }

  sections.push(sectionImplementationOrder(answers, tier));
  sections.push(sectionDeployment(answers, tier));
  sections.push(sectionPostDeployment(answers, tier));
  sections.push(sectionSuggestedPrompt(answers, tier));
  sections.push(sectionFooter(meta));

  return sections.filter(Boolean).join('\n\n');
}

/** Generate the kebab-case filename */
export function generateFilename(answers: Partial<UserAnswers>): string {
  const title = answers.title ?? 'my-app';
  const kebab = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${kebab}-gist-spec-v${GIST_VERSION}.md`;
}

// --- Helpers ---

function hasExternalData(a: Partial<UserAnswers>): boolean {
  return a.dataSource === 'public-api' || a.dataSource === 'rss' || a.dataSource === 'static-file' || a.dataSource === 'other';
}

function hasUserContent(a: Partial<UserAnswers>): boolean {
  return a.dataSource === 'user-content';
}

function hasResearchNotes(a: Partial<UserAnswers>): boolean {
  return hasExternalData(a) || a.hosting === 'unsure' || a.scale === 'unsure';
}

function hostingName(a: Partial<UserAnswers>): string {
  const map: Record<string, string> = {
    'cloudflare-pages': 'Cloudflare Pages',
    'github-pages': 'GitHub Pages',
    'vercel': 'Vercel',
    'netlify': 'Netlify',
    'unsure': 'Cloudflare Pages (recommended)',
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

// --- Section builders ---

function sectionTitle(a: Partial<UserAnswers>): string {
  return `# ${a.title ?? 'My App'} — Gist Specification`;
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

  parts.push(`> ${a.description ?? 'A web application.'}`);

  if (hasExternalData(a) && a.apiKnownName) {
    parts.push(`> Uses ${a.apiKnownName} for data.`);
  }

  if (needsWorkerProxy(a)) {
    parts.push('> API proxied through a server-side Worker to keep keys private.');
  }

  parts.push(`> ${tierInfo.framework}. Hosted on ${hostingName(a)}.`);

  return `## Summary\n${parts.join('\n')}`;
}

function sectionIdea(a: Partial<UserAnswers>): string {
  const lines = [
    '## Idea',
    `- Title: ${a.title ?? 'Untitled'}`,
    `- Description: ${a.description ?? ''}`,
  ];

  if (a.audience) lines.push(`- Audience: ${a.audience}`);
  if (a.usageFrequency) lines.push(`- Usage pattern: ${a.usageFrequency}${a.deviceTarget ? `, ${a.deviceTarget}` : ''}`);
  if (a.headlineValue) lines.push(`- Headline value: ${a.headlineValue}`);

  return lines.join('\n');
}

function sectionArchitecture(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines: string[] = ['## Architecture'];

  // Data & Caching (conditional)
  if (hasExternalData(a)) {
    lines.push('');
    lines.push('### Data & Caching');

    if (a.apiKnownName) {
      lines.push(`- Data source: ${a.apiKnownName}`);
    } else if (a.apiDescription) {
      lines.push(`- Data source: ${a.apiDescription}`);
    }

    if (a.dataFreshness) {
      const freshnessMap: Record<string, string> = {
        realtime: 'Real-time (fetch on each request)',
        hourly: 'Hourly (cron job + cache)',
        daily: 'Daily or less (bake into build or cache with long TTL)',
        static: 'Static (fetch once, cache indefinitely)',
      };
      lines.push(`- Update frequency: ${freshnessMap[a.dataFreshness]}`);
    }

    if (needsCron(a)) {
      lines.push('- Caching strategy: Cron job updates cache hourly. Frontend reads from cache (fast, no API key exposed).');
    } else if (needsWorkerProxy(a)) {
      lines.push('- Caching strategy: Worker proxies API calls. Consider adding cache headers for repeat requests.');
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
  if (hasExternalData(a) && (a.apiDescription || a.apiKnownName)) {
    lines.push('');
    lines.push('### APIs to Integrate');

    if (a.apiKnownName) {
      lines.push(`- **${a.apiKnownName}**`);
    }

    if (a.apiDescription) {
      lines.push(`  - Data needed: ${a.apiDescription}`);
    }

    const proxyNeeded = needsWorkerProxy(a);
    lines.push(`  - CORS from browser: ${proxyNeeded ? 'Verify — may need Worker proxy' : 'Verify availability'}`);

    if (proxyNeeded) {
      lines.push('  - **Action: Research this API. Determine: free tier limits, auth requirements, CORS support. If API key required, route through Worker proxy — never expose in frontend.**');
    } else {
      lines.push('  - **Action: Research this API. Determine: free tier limits, auth requirements, CORS support, rate limits.**');
    }
  }

  // User Input & Storage (conditional)
  if (hasUserContent(a)) {
    lines.push('');
    lines.push('### User Input & Storage');

    if (a.userInputType === 'simple-form') {
      lines.push('- Type: Simple form submission (contact, feedback, newsletter)');
      lines.push('- Storage: Consider Cloudflare Workers KV, Formspree, or Netlify Forms');
      lines.push('- Validation: Client-side + server-side. Sanitize all input. CSRF protection if using custom backend.');
    } else if (a.userInputType === 'user-saves-data') {
      lines.push('- Type: Users create and save data (accounts, preferences, entries)');
      lines.push('- Storage: Requires a database. Consider Cloudflare D1 (SQLite), Supabase, or Firebase.');
      lines.push('- **Note: This significantly increases complexity. Consider whether the MVP can launch with simpler storage (localStorage, KV) and upgrade later.**');
    } else {
      lines.push('- Type: Display only — content is pre-loaded, users view it');
      lines.push('- No user input handling needed');
    }
  }

  return lines.join('\n');
}

function sectionDesign(a: Partial<UserAnswers>): string {
  const lines = [
    '## Design Decisions',
    `- Vibe: ${vibeName(a)}`,
    `- Information density: ${densityName(a)}`,
    '- Fonts: system-ui stack (fast loading, native feel)',
    '- Theme: Respect OS dark/light mode via `prefers-color-scheme`',
    '- Design tokens in `:root` custom properties',
  ];

  return lines.join('\n');
}

function sectionUXStates(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## UX States', ''];

  lines.push('- **Loading** — Show loading indicator or skeleton while data loads. Show immediately on interaction.');

  if (hasExternalData(a)) {
    lines.push('- **Empty / First Use** — Prompt user for initial input or location. Clear call to action.');
    lines.push('- **Error (API)** — Friendly error message with "Try again" button. Never a dead end.');
    lines.push('- **Error (Network)** — "Check your connection" message with retry option.');
  }

  lines.push('- **Success** — Primary content displayed. Clean, focused layout matching the design vibe.');

  if (hasExternalData(a) && needsCron(a)) {
    lines.push('- **Stale data** — If cached data is old, show warning: "Data may be outdated. Last updated: [time]."');
  }

  if (hasUserContent(a)) {
    lines.push('- **Form validation** — Inline validation with helpful messages. Don\'t block submission for optional fields.');
  }

  lines.push('- **Offline** — Show appropriate message. If PWA with cache, show last-known data.');

  return lines.join('\n');
}

function sectionWiringGuide(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Wiring Guide'];

  // Only include if there's meaningful wiring
  if (tier === 'minimal' && !hasExternalData(a) && !hasUserContent(a)) {
    lines.push('');
    lines.push('### Data Flow');
    lines.push('- Static content rendered directly in HTML. No external data dependencies.');
    lines.push('');
    lines.push('### Pre-Ship Checklist (for agentic system)');
    lines.push('> **IMPORTANT: The repo may be public. Complete before deploying.**');
    appendMinimalChecklist(lines);
    return lines.join('\n');
  }

  if (hasExternalData(a) || hasUserContent(a)) {
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
      lines.push(`${needsCron(a) ? '7' : '5'}. Browser renders data using safe DOM methods (\`textContent\`, not \`innerHTML\`)`);
    } else {
      lines.push('1. Browser fetches data directly from API (no key needed, CORS-friendly)');
      lines.push('2. Browser renders data using safe DOM methods (`textContent`, not `innerHTML`)');
    }
  }

  // Trust Boundary
  if (needsWorkerProxy(a) || hasUserContent(a)) {
    lines.push('');
    lines.push('### Trust Boundary');
    lines.push('- Browser (public): renders UI, fetches from Worker or public APIs');

    if (needsWorkerProxy(a)) {
      lines.push('- Worker (private): holds API keys, proxies requests, reads/writes cache');
      lines.push('- **Never expose:** API keys must not appear in frontend JS, HTML, config, or git history');
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
    lines.push('| API key | Cloudflare Worker | `npx wrangler secret put API_KEY` | Worker (API fetch) |');

    if (needsCron(a)) {
      lines.push('| API key | GitHub Actions | Settings > Secrets > Actions | Cron workflow |');
      lines.push('| `CF_API_TOKEN` | GitHub Actions | Settings > Secrets > Actions | Cron trigger auth |');
    }
  }

  // Pre-Ship Checklist
  lines.push('');
  lines.push('### Pre-Ship Checklist (for agentic system)');
  lines.push('> **IMPORTANT: The repo may be public. Complete before deploying.**');

  if (needsWorkerProxy(a)) {
    lines.push('');
    lines.push('**Security:**');
    lines.push('- [ ] `git log -p | grep -i` for: API_KEY, SECRET, TOKEN, PASSWORD — must find zero matches');
    lines.push('- [ ] Search `dist/` build output for API key strings — must find zero matches');
    lines.push('- [ ] Verify no secrets in any committed file');
    lines.push('- [ ] Verify Worker does not echo API key in responses or error messages');
    lines.push('- [ ] Verify `.env`, `.env.*`, `*.local` are in `.gitignore`');
    lines.push('- [ ] Verify app starts correctly with empty `.env` — secrets come from platform');
  }

  appendMinimalChecklist(lines);

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

  if (needsWorkerProxy(a)) {
    lines.push('| `.env.example` | Placeholder for API keys (never real values) |');
    lines.push('| `wrangler.toml` | Worker config (no secrets — set via CLI) |');
  }

  if (tier !== 'minimal') {
    lines.push('| `sitemap.xml` | List of pages |');
  }

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

  if (a.deviceTarget === 'phone' || a.deviceTarget === 'both') {
    lines.push('- Mobile-first layout with comfortable touch spacing');
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
  const lines = ['## Agentic Research Notes', '> **For Claude/Cursor/Codex:**', '>'];

  if (hasExternalData(a)) {
    if (a.apiKnownName) {
      lines.push(`> **${a.apiKnownName} verification:**`);
      lines.push('> - Confirm free tier limits and rate limits');
      lines.push('> - Confirm auth requirements (API key? OAuth? None?)');
      lines.push('> - Confirm CORS support for browser-side requests');

      if (a.apiDescription) {
        lines.push(`> - Verify these data fields are available: ${a.apiDescription}`);
      }

      lines.push('> - If API key is required, route through Worker proxy — never expose in frontend');
    } else if (a.apiDescription) {
      lines.push('> **API research needed:**');
      lines.push(`> - User needs: ${a.apiDescription}`);
      lines.push('> - Research suitable APIs. Evaluate: free tier limits, auth requirements, CORS support, data quality');
      lines.push('> - Prefer APIs with generous free tiers and no API key requirement');
      lines.push('> - If API key is required, plan for Worker proxy');
    }
  }

  if (a.hosting === 'unsure') {
    lines.push('>');
    lines.push('> **Hosting recommendation:**');
    lines.push('> - Cloudflare Pages: Unlimited builds, global CDN, atomic deploys, Workers integration');
    lines.push('> - GitHub Pages: Simplest setup, great for static sites');
    lines.push('> - Vercel: Great developer experience, 100 GB bandwidth/month');
    lines.push('> - Netlify: Form handling built in, 100 GB bandwidth/month');
    lines.push('> - Recommend based on the app\'s needs (Worker integration? Forms? Simplicity?)');
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

function sectionImplementationOrder(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Implementation Order'];
  let step = 1;

  if (tier === 'minimal') {
    lines.push(`${step++}. **Scaffold** — Create \`index.html\`, \`style.css\`, \`app.js\`, \`favicon.svg\`, \`robots.txt\`, \`.gitignore\``);
  } else {
    lines.push(`${step++}. **Scaffold** — \`npm create astro@latest\`, configure \`astro.config.mjs\`, \`.gitignore\``);
  }

  lines.push(`${step++}. **HTML shell** — Semantic markup with all UX states (loading, error, success). No data yet.`);
  lines.push(`${step++}. **Styles** — Design tokens, palette, dark mode, responsive layout, 44px touch targets`);
  lines.push(`${step++}. **Mock data** — Render the UI with hardcoded data so you can approve the design`);

  if (needsWorkerProxy(a)) {
    lines.push(`${step++}. **Worker** — Create Cloudflare Worker with API proxy endpoint`);
  }

  if (hasExternalData(a)) {
    lines.push(`${step++}. **Connect data** — Fetch from ${needsWorkerProxy(a) ? 'Worker' : 'API'}, render real data`);
  }

  if (needsCron(a)) {
    lines.push(`${step++}. **Cron** — GitHub Actions hourly trigger for cache refresh`);
  }

  lines.push(`${step++}. **Error handling** — API failures, loading states, offline fallback`);
  lines.push(`${step++}. **Web standards** — favicon, og:image, CSP, meta tags, robots.txt, Lighthouse audit`);
  lines.push(`${step++}. **Deploy** — Push to GitHub, connect to hosting, verify deployment`);
  lines.push(`${step++}. **Polish** — Lighthouse 90+, accessibility audit, mobile testing`);

  return lines.join('\n');
}

function sectionDeployment(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = ['## Deployment'];
  let step = 1;
  const host = hostingName(a);

  if (needsWorkerProxy(a)) {
    lines.push(`${step++}. **Worker:** \`npx wrangler deploy\` — verify at your Worker URL`);
    lines.push(`${step++}. **Worker secret:** \`npx wrangler secret put API_KEY\` — enter key when prompted`);

    if (tier === 'full') {
      lines.push(`${step++}. **KV:** Create namespace in Cloudflare dashboard, copy ID, add to \`wrangler.toml\``);
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

function sectionPostDeployment(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const lines = [
    '## Post-Deployment',
    '- **Monitoring:** Visit your app periodically. Check that core functionality works.',
  ];

  const host = hostingName(a);
  lines.push(`- **Analytics:** ${host} provides built-in analytics (free).`);

  if (hasExternalData(a)) {
    lines.push('- **API changes:** External APIs may change. Pin to API version if available.');
  }

  if (needsCron(a)) {
    lines.push('- **Cron health:** Check GitHub Actions runs — failed crons mean stale data.');
  }

  lines.push('- **Adding features:** Ask Claude with this spec as context for guided implementation.');

  return lines.join('\n');
}

function sectionSuggestedPrompt(a: Partial<UserAnswers>, tier: ComplexityTier): string {
  const tierInfo = tierDescriptions[tier];
  const lines = [
    '## Suggested Prompt',
    '> Copy this prompt and paste it into Claude/Cursor along with this spec:',
    '',
    '"Here is my app specification generated by Gist. Please:',
    '1. Review the spec and confirm you understand the architecture',
    '2. Ask me any clarifying questions before starting',
    '3. Build it step by step — start with the HTML shell and mock data so I can see the design early',
    '4. Follow the Implementation Order in the spec',
    '5. Complete the Pre-Ship Checklist before we deploy',
    '6. Help me through the Configuration Checklist and Deployment steps',
  ];

  if (needsWorkerProxy(a)) {
    lines.push('7. Set up the Worker with proper secret handling (never commit API keys)');
  }

  lines.push('');

  if (tier === 'minimal') {
    lines.push(`Important: this is a minimal-tier app. ${tierInfo.framework} — no frameworks, no build tools, no server-side components. Keep it simple."`);
  } else if (tier === 'standard') {
    lines.push(`Important: this is a standard-tier app using ${tierInfo.framework}. Follow the architecture decisions in the spec."`);
  } else {
    lines.push(`Important: this is a full-tier app with ${tierInfo.framework}. Follow the architecture exactly — caching, cron, and proxy are all needed."`);
  }

  return lines.join('\n');
}

function sectionFooter(meta: SpecMeta): string {
  return `---\n\n**Generated by Gist v${meta.gistVersion}** | ${meta.generated}`;
}
