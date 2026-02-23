# Gist — Project Guidelines

## What This Is
Gist is a zero-stack app spec generator. Users describe an app idea, answer structured questions, and download a markdown spec for AI coding assistants (Claude, Cursor, Codex). Static Astro site on Cloudflare Pages. No server, no database — client-side spec generation.

## Architecture
- **Framework:** Astro 5 (static output, no SSR)
- **Styling:** Vanilla CSS with custom properties (no Tailwind, no CSS-in-JS)
- **JS:** Vanilla TypeScript in Astro components + standalone modules in `src/lib/`
- **State:** Client-side only. Question answers stored in memory, spec generated on demand.
- **Hosting:** Cloudflare Pages (static deploy)

## Project Structure
```
src/
  layouts/       # Base HTML layout
  pages/         # Astro pages (index, create, spec preview)
  components/    # Astro components (.astro files)
  lib/           # TypeScript modules (question engine, spec generator, types)
  styles/        # Global CSS (tokens, reset, utilities)
public/          # Static assets (favicon, og-image, robots.txt)
todos/           # PRD, sample specs, dry-run prototype (not deployed)
```

## Code Conventions
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<footer>` — no div soup
- CSS: design tokens in `:root`, mobile-first, `prefers-color-scheme` for dark mode
- TypeScript strict mode. No `any`. Types in `src/lib/types.ts`.
- No innerHTML with dynamic content. Use textContent or DOM APIs.
- Externalized CSS/JS — no inline styles or scripts in Astro layouts
- `<script defer>` for client-side JS

## Design Language
- Vibe: Calm, professional, trustworthy. Not flashy, not boring.
- Palette: Cool neutrals with a single accent color. Dark mode via OS preference.
- Typography: system-ui stack. Large headings, comfortable reading size.
- Layout: Mobile-first, max-width container, generous whitespace.
- Touch targets: 44px minimum on interactive elements.

## Key Files
- `todos/prd.md` — Product requirements (v1.0, approved)
- `todos/sample-spec-weather-simple.md` — Minimal tier reference spec
- `todos/sample-spec-weather-full.md` — Standard tier reference spec
- `src/lib/types.ts` — Core type definitions
- `src/lib/questions.ts` — Question definitions and dependency graph
- `src/lib/generator.ts` — Spec generation engine
- `src/lib/complexity.ts` — Complexity router logic

## Non-Negotiables
- No secrets in frontend code
- Spec preview before download
- Options on platter (no dropdowns)
- Complexity router: default to minimal tier
- Every spec includes: UX states, pre-ship checklist, implementation order, suggested prompt
- Accessibility: keyboard nav, WCAG AA contrast, reduced-motion support
