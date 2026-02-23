# Architecture

Gist is a static site that generates app specifications entirely in the browser. No server, no database, no authentication.

## Runtime Model

Everything runs client-side. The Astro build produces static HTML/CSS/JS files deployed to a CDN. When a user fills out the question flow, JavaScript modules in the browser:

1. Track answers in memory (no persistence beyond the session)
2. Route answers through the complexity engine to determine an architecture tier
3. Assemble a markdown spec from the answers and tier
4. Render the spec for preview and offer it as a downloadable file

There is no API layer. The spec generation logic ships to the browser as bundled TypeScript modules.

## Core Modules

Three TypeScript modules in `src/lib/` contain the product logic:

### `questions.ts` — Question Engine

Defines the structured question flow users walk through. Each question has:

- An ID, title, and response mode (`pick-one`, `free-text`, or `multi-field`)
- Optional visibility conditions (e.g., the data freshness question only appears when an external data source is selected)
- Persona overlays that adjust wording and auto-default certain answers for non-technical users

Key exports:

- `questions` — the full question definition array
- `getVisibleQuestions(answers)` — returns questions visible for the current answer state
- `resolveQuestion(question, persona)` — applies persona-specific text overlays
- `getAutoDefault(questionId, persona)` — returns default values for the new-builder persona
- `mapOptionToAnswer(questionId, optionId)` — maps question option IDs to `UserAnswers` keys

### `complexity.ts` — Complexity Router

Maps user answers to one of three architecture tiers:

| Tier         | Criteria                                                          | Output                            |
| ------------ | ----------------------------------------------------------------- | --------------------------------- |
| **Minimal**  | Personal use, no external APIs, simple pages                      | Plain HTML/CSS/JS, no build tools |
| **Standard** | Public API integration, user-saved data, or moderate scale        | Astro site with Worker proxy      |
| **Full**     | Public scale + hourly data refresh, or many pages at public scale | Astro + Workers + KV cache + cron |

The router defaults to minimal. It only escalates when answers explicitly demand more infrastructure. This prevents the over-engineering trap where every app gets maximum complexity.

Helper functions expose specific architecture decisions:

- `needsWorkerProxy(answers)` — true when API keys need server-side protection
- `needsCron(answers)` — true when data must refresh on a schedule
- `shouldRecommendPWA(answers)` — true for daily mobile usage patterns

### `generator.ts` — Spec Generator

Takes user answers and the computed complexity tier, then assembles a markdown specification. The spec always includes:

- Meta (version, date, persona, tier)
- Summary and idea description
- Architecture decisions (hosting, framework, data flow, APIs)
- Design decisions (vibe, density, theme support)
- UX states (loading, error, success, offline)
- Wiring guide with data flow diagrams
- Content Security Policy
- Accessibility requirements
- Pre-ship checklist
- Implementation order (step-by-step build sequence)
- Deployment instructions
- Suggested prompt for AI coding assistants

Sections are conditionally included based on answers. A minimal personal app gets a short spec. A full-tier public app gets Worker configuration, cron setup, KV caching, and budget math.

### `types.ts` — Type Definitions

Shared TypeScript types used across all modules. Defines the `UserAnswers` interface (the complete set of form responses), `ComplexityTier`, `QuestionDef`, `PersonaOverlay`, and related types. Strict mode enforced — no `any`.

## Pages

| Route     | File                     | Purpose                                                            |
| --------- | ------------------------ | ------------------------------------------------------------------ |
| `/`       | `src/pages/index.astro`  | Landing page — explains what Gist does, links to the question flow |
| `/create` | `src/pages/create.astro` | Question flow — stepped form, progress indicator, all client-side  |
| `/spec`   | `src/pages/spec.astro`   | Spec preview — renders generated markdown, download button         |
| `/404`    | `src/pages/404.astro`    | Custom 404 with navigation back to home                            |

All pages share a common layout (`src/layouts/Base.astro`) that provides the HTML shell, meta tags, and asset references.

## Styling

Vanilla CSS with no framework dependencies. The design system is token-based:

- `src/styles/tokens.css` — color palette, typography scales, spacing, shadows, transitions
- `src/styles/reset.css` — CSS reset for consistent cross-browser baseline
- `src/styles/global.css` — shared component styles (header, footer, buttons, cards)
- `src/styles/fonts.css` — self-hosted font declarations (DM Sans, DM Mono, Instrument Serif)

Dark mode is automatic via `prefers-color-scheme`. Reduced motion is respected via `prefers-reduced-motion`. See [Design System](design-system.md) for token details.

## Build & Deploy

Astro builds the site to static files in `dist/`. The `@astrojs/sitemap` integration generates a sitemap automatically. Cloudflare Pages deploys on push to the main branch.

```
npm run build → dist/ → Cloudflare Pages CDN
```

No server-side rendering. No edge functions. No database connections. The deployed artifact is HTML, CSS, JS, and static assets.

## Offline Support

A service worker (`public/sw.js`) provides offline-first caching:

- **HTML pages:** Network-first with cache fallback (always get latest deploy)
- **Static assets:** Cache-first with network fallback (fonts, CSS, JS, images)
- Pre-caches all pages and fonts on install

A web app manifest (`public/site.webmanifest`) enables add-to-homescreen on mobile.
