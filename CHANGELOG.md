# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-02-24

### Fixed

- UX: reduced spec-navigation delay from 1200ms to 500ms for natural pacing
- UX: `saveProgress()` failures now surface an inline note instead of failing silently
- UX: `downloadSpec()` failures show "Download failed — try again" on button for 3 seconds
- A11y: disabled Next button now has `aria-describedby` hint ("Select an option to continue")
- A11y: empty admin token field shows `aria-invalid` outline with clear-on-input
- Admin: loading spinner CSS no longer overrides `hidden` attribute (`display: flex` → `:not([hidden])`)
- Service worker: bumped cache version to gist-v6

## [1.2.0] - 2026-02-24

### Added

- Admin dashboard redesign: signal panels with horizontal bars, period selector (24h/7d/30d), funnel drop-off insight, satisfaction donut (conic-gradient), tier/persona split, after-download actions
- New-builder persona overlays for Q6a (user-input), Q10 (offline), Q8a (design-vibe) — jargon-free wording
- `page_viewed` tracking event for funnel analysis (fires on /create load)
- 90-day TTL (`expirationTtl: 7_776_000`) on all KV writes for automatic data expiry
- Context-aware empty state on admin dashboard when period has no events
- 7 new tests (persona overlays, page_viewed round-trip, KV TTL verification)

### Changed

- Question flow: removed auto-advance setTimeout — users now advance manually via Next button
- Admin: fetch window extended from 14 to 30 days
- Admin: loading guard prevents double-submit, button shows "Loading..." state
- Admin: all DOM construction uses createElement/textContent (no innerHTML)
- Service worker: bumped cache version to gist-v5

### Fixed

- Admin: Load stats button re-enabled on success path (was stuck disabled if auth form reshown)

## [1.1.1] - 2026-02-24

### Fixed

- **Security:** `timingSafeCompare` no longer leaks token length via early return — pads shorter input and XORs all bytes with length-mismatch flag
- **Security:** `sessionStorage.getItem` in spec.astro wrapped in try-catch (private browsing, storage disabled)
- **Security:** deploy.yml actions pinned to commit SHAs (supply chain hardening)
- Worker: corrupt KV values preserved for inspection instead of silently overwriting with 1
- Worker: stats endpoint reads count from KV metadata instead of N+1 individual get() calls
- Worker: float `stepIndex` values rejected at dimensional key boundary
- Worker: OPTIONS preflight scoped to `/api/event` and `/api/stats` only (was matching all paths)
- Worker: `MAX_PAYLOAD_BYTES` renamed to `MAX_PAYLOAD_CHARS` (measures chars, not bytes)
- Worker: `compatibility_date` bumped from 2025-01-01 to 2025-12-01
- Frontend: create.astro shows error UI instead of navigating when sessionStorage write fails
- Frontend: prompt extraction regex moved to exported `extractSuggestedPrompt()` helper in generator.ts
- Frontend: variable shadow fixed (`raw` → `feedbackRaw` in spec.astro feedback handler)
- Core: `needsWorkerProxy` now handles `'other'` data source with public scale
- Core: dead `'other'` variant removed from `HostingPlatform` type
- Core: `sectionBudgetMath` accepts `tier` parameter instead of recomputing it
- Core: `hasExternalData`/`hasUserContent` renamed to `hasResolvedExternalData`/`hasResolvedUserContent` to distinguish from questions.ts versions
- OG image: converted from SVG to PNG for social crawler compatibility
- Node engine requirement bumped from >=18 to >=22 (matches CI)

## [1.1.0] - 2026-02-24

### Added

- Insights tracking module (`src/lib/insights.ts`) — fire-and-forget sendBeacon
- Funnel event tracking: persona selection, question flow, spec generation, downloads, copies, feedback
- Gist Insights Worker (Cloudflare Workers + KV) for custom event collection
- Admin page (`/admin`) for viewing funnel stats (noindex, token-protected)
- Worker health routes (`/` and `/health`) for UptimeRobot monitoring

### Changed

- CSP: added Worker URL to connect-src
- Feedback: now beacons to Worker in addition to localStorage
- Monitoring: add UptimeRobot HTTP monitor for Worker health (`/health` endpoint)
- Service worker: bumped cache version to gist-v4

## [1.0.1] - 2026-02-24

### Changed

- Hosting: migrated from GitHub Pages to Cloudflare Pages
- Added Cloudflare Web Analytics (privacy-first, no cookies, auto-injected)
- CSP: added CF Web Analytics domains to script-src and connect-src
- CSP: added `_headers` file for CF Pages (meta tag kept as fallback)
- Deploy workflow: unified Pages + Worker deploy on release publish (wrangler CLI, no Git connect)
- Monitoring: add UptimeRobot HTTP monitor for `https://gist.1mb.dev`
- Service worker: bumped cache version to gist-v3

### Removed

- GitHub Pages CNAME file
- GitHub Pages deploy job from CI

## [1.0.0] - 2026-02-24

### Added

- Persona fork: new-builder (jargon-free) and developer paths
- Structured question flow with conditional visibility and auto-defaults
- Complexity router: minimal / standard / full tiers based on answers
- Spec generator producing deployment-ready markdown for AI coding assistants
- Spec preview page with download, clipboard copy, and suggested prompt
- Design system: Editorial Craft aesthetic with dark mode, fluid typography
- Self-hosted fonts (DM Sans, DM Mono, Instrument Serif)
- Service worker for offline caching (network-first pages, cache-first assets)
- PWA recommendation for daily mobile apps
- CSP, sitemap, canonical URLs, skip-nav, 404 page
- Persona-aware question overlays and "unsure" option resolution
- Generated specs include: architecture, UX states, wiring guide, pre-ship checklist, implementation order, deployment steps, suggested prompt, CSP policy, accessibility requirements, free tier budget math, and agentic research notes
- oat CSS and lightweight library recommendations in generated specs
- SiteHeader component (extracted from 3 pages)
- Unit tests: 59 tests covering complexity router, question engine, and generator
- CI workflow (lint + test + build on push/PR)
- Tagged-release deploy workflow (GitHub Pages via actions/deploy-pages)

### Fixed

- Complexity router: `realtime` freshness now correctly triggers full tier
- Complexity router: `friends` scale with hourly/realtime triggers full tier (consistent with cron recommendation)
- Question flow: `isDailyMobile` resolves `unsure` → `both` (matches `shouldRecommendPWA`)
- Service worker: precache URLs use trailing slashes matching Astro directory output
- Spec output: markdown injection prevented via `sanitizeLine`/`sanitizeBlock`
- HTML: self-closing `<code />` corrected to `<code></code>` in build output
- Removed dead `free-text` response mode from types
- Removed unreachable `api-details` branch in `renderOptions()`

[1.2.1]: https://github.com/1mb-dev/gistapp/releases/tag/v1.2.1
[1.2.0]: https://github.com/1mb-dev/gistapp/releases/tag/v1.2.0
[1.1.1]: https://github.com/1mb-dev/gistapp/releases/tag/v1.1.1
[1.1.0]: https://github.com/1mb-dev/gistapp/releases/tag/v1.1.0
[1.0.1]: https://github.com/1mb-dev/gistapp/releases/tag/v1.0.1
[1.0.0]: https://github.com/1mb-dev/gistapp/releases/tag/v1.0.0
