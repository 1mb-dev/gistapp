# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/1mb-dev/gistapp/releases/tag/v1.0.0
