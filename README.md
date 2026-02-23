# Gist

**Turn app ideas into deployment-ready specs.**

Gist is a zero-stack app spec generator. Describe your idea, answer a few architecture questions, and download a markdown spec you can hand to Claude, Cursor, or Codex for implementation.

Try it at [gist.1mb.dev](https://gist.1mb.dev).

---

## Why Gist?

AI coding assistants produce better output when given clear constraints and architectural decisions upfront. But structuring those decisions requires knowledge most people don't have — free tier limits, caching strategies, CORS proxies, data freshness patterns.

Gist captures those decisions through a guided question flow and generates a spec that includes everything an AI assistant needs: architecture, UX states, implementation order, and a suggested prompt.

The spec matches the app's actual complexity. A personal weather app gets 4 static files. A public dashboard with live data gets a Worker proxy and cron jobs. Gist's complexity router prevents over-engineering.

## How It Works

1. **Describe** your app idea (title, audience, what it does)
2. **Answer** structured questions about data, scale, hosting, and design
3. **Preview** the generated spec in-browser
4. **Download** the markdown file and hand it to your AI assistant

The entire flow runs client-side. No server, no database, no account required.

## Architecture

Gist is a static Astro site deployed to Cloudflare Pages.

- **Framework:** [Astro 5](https://astro.build) with static output
- **Styling:** Vanilla CSS with custom properties — no framework dependencies
- **Logic:** TypeScript modules handle question routing, complexity detection, and spec generation
- **Hosting:** Cloudflare Pages (zero cost, global CDN)

Three core modules drive the product:

| Module                  | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `src/lib/questions.ts`  | Question definitions, conditional visibility, persona overlays |
| `src/lib/complexity.ts` | Routes answers to minimal/standard/full architecture tiers     |
| `src/lib/generator.ts`  | Assembles the final markdown spec from answers + tier          |

See [docs/architecture.md](docs/architecture.md) for details.

## Development

Requires Node.js 18+.

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Check formatting and types
npm run lint

# Build for production
npm run build
```

### Scripts

| Command           | What it does                                      |
| ----------------- | ------------------------------------------------- |
| `npm run dev`     | Start Astro dev server                            |
| `npm test`        | Run Vitest unit tests                             |
| `npm run lint`    | Check formatting (Prettier) + types (astro check) |
| `npm run format`  | Auto-format all files                             |
| `npm run check`   | Type-check Astro files                            |
| `npm run build`   | Production build to `dist/`                       |
| `npm run preview` | Preview production build locally                  |

### Project Structure

```
src/
  layouts/Base.astro       # HTML shell, meta tags, asset links
  pages/                   # Routes: index, create, spec, 404
  styles/                  # Design tokens, reset, global styles, fonts
  lib/                     # TypeScript: questions, complexity, generator, types
public/                    # Static assets: favicon, OG image, service worker, fonts
```

## Documentation

- [Architecture](docs/architecture.md) — How the pieces fit together
- [Design System](docs/design-system.md) — Tokens, typography, color, dark mode
- [Spec Generation](docs/spec-generation.md) — How specs are assembled from answers
- [Contributing](docs/contributing.md) — Setup, conventions, how to submit changes

## License

MIT
