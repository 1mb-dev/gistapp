# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.1.0]: https://github.com/1mb-dev/gistapp/releases/tag/v1.1.0
[1.0.1]: https://github.com/1mb-dev/gistapp/releases/tag/v1.0.1
[1.0.0]: https://github.com/1mb-dev/gistapp/releases/tag/v1.0.0
