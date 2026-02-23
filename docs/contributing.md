# Contributing

Gist is a small, focused project. Contributions that align with its goals are welcome.

## Setup

```bash
git clone https://github.com/1mb-dev/gistapp.git
cd gistapp
npm install
npm run dev
```

The dev server starts at `http://localhost:4321` (or the next available port). All three pages are accessible: landing (`/`), question flow (`/create`), and spec preview (`/spec`).

## Project Layout

```
src/
  layouts/Base.astro         # HTML shell shared by all pages
  pages/                     # Routes — index, create, spec, admin, 404
  styles/                    # tokens.css, reset.css, global.css, fonts.css
  lib/                       # Core logic — questions, complexity, generator, insights, types
    *.test.ts                # Vitest unit tests alongside source
worker/
  src/index.ts               # Insights Worker (event ingestion, stats API)
  src/index.test.ts          # Worker unit tests
  wrangler.toml              # Cloudflare Worker config + KV binding
public/                      # Static assets — favicon, OG image, fonts, service worker
docs/                        # Project documentation
```

## Code Conventions

**TypeScript:** Strict mode. No `any`. Types live in `src/lib/types.ts`.

**CSS:** Design tokens as custom properties in `tokens.css`. Mobile-first. Dark mode via `prefers-color-scheme`. No CSS framework.

**HTML:** Semantic elements (`<header>`, `<main>`, `<section>`, `<footer>`). No `innerHTML` with dynamic content — use `textContent` or DOM APIs.

**Astro:** Pages in `src/pages/`. Client-side JavaScript in `<script>` tags with `defer`. Externalized CSS via `<link>` in the layout.

## Commands

| Command               | Purpose                       |
| --------------------- | ----------------------------- |
| `npm run dev`         | Start dev server              |
| `npm test`            | Run all tests (site + worker) |
| `npm run lint`        | Check formatting + types      |
| `npm run format`      | Auto-format with Prettier     |
| `npm run build`       | Production build              |
| `npm run worker:dev`  | Start Worker dev server       |
| `npm run worker:test` | Run Worker tests only         |

## Running Tests

Tests cover the core logic modules and the Insights Worker:

```bash
npm test           # all tests (75 total)
npm run worker:test  # worker tests only
```

Site test files live next to their source files (`complexity.test.ts`, `generator.test.ts`, `questions.test.ts`) and test pure functions. Worker tests (`worker/src/index.test.ts`) use mock KV bindings to test HTTP handlers.

## Making Changes

1. Create a branch from `main`
2. Make your changes
3. Run `npm run lint` — formatting and type errors must be clean
4. Run `npm test` — all tests must pass
5. Run `npm run build` — verify the production build succeeds
6. Submit a pull request with a clear description of what changed and why

## What Belongs Here

Gist generates specs. It doesn't implement them. Changes should serve one of these goals:

- **Better specs** — more accurate architecture decisions, better section content, smarter defaults
- **Better questions** — clearer wording, better option coverage, smarter conditional logic
- **Better experience** — accessibility improvements, performance, clearer UI
- **Maintenance** — dependency updates, bug fixes, documentation

## What Doesn't Belong

- CSS frameworks or UI libraries
- Features that expand scope beyond spec generation
- Dependencies without clear justification
- New server-side endpoints beyond analytics (the Worker exists for insights only)

## License

MIT. By contributing, you agree that your contributions will be licensed under the same terms.
