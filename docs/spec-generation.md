# Spec Generation

## The Pipeline

```
User answers → Complexity router → Spec generator → Markdown output
```

1. **User answers** are collected through the question flow on `/create`. Each answer maps to a typed field on the `UserAnswers` interface.

2. **Complexity router** (`src/lib/complexity.ts`) examines the answers and assigns a tier: minimal, standard, or full. The router defaults to minimal and only escalates when specific answer combinations demand more infrastructure.

3. **Spec generator** (`src/lib/generator.ts`) takes the answers and tier, then assembles markdown sections. Each section function checks relevant answers and produces conditional content.

4. **Markdown output** is rendered in the browser on `/spec` for preview, then downloadable as a `.md` file.

## Complexity Tiers

The tier determines what infrastructure the generated spec prescribes.

### Minimal

**Triggers:** Personal use, no external APIs requiring keys, single page, or all "unsure" answers.

**Architecture:** Plain HTML, CSS, and JavaScript. No build tools, no framework, no server-side components. A single `index.html` with externalized `style.css` and `app.js`.

**Use case:** A personal calculator, a reference page, a static portfolio.

### Standard

**Triggers:** User-saved data, public-scale API integration, or multiple pages.

**Architecture:** Astro static site generator. May include a Cloudflare Worker as an API proxy (when keys need protection). GitHub Actions for deployment.

**Use case:** A weather dashboard pulling from a public API, a personal app that saves user preferences.

### Full

**Triggers:** Public scale with hourly data freshness, or many pages at public scale.

**Architecture:** Astro + Cloudflare Workers + KV cache + GitHub Actions cron. The full infrastructure stack for apps that need scheduled data refresh and edge caching.

**Use case:** A public transit tracker with hourly updates, a multi-page data dashboard.

## Handling "Unsure"

When users select "I'm not sure" for any question, the system applies conservative defaults:

| Question       | "Unsure" becomes        | Reasoning                           |
| -------------- | ----------------------- | ----------------------------------- |
| Data source    | No external data        | Avoids unnecessary API complexity   |
| Data freshness | Daily                   | Low API usage, simple caching       |
| Page count     | Single                  | Simplest possible structure         |
| Device target  | Both                    | Safe default that covers all users  |
| Scale          | Triggers research notes | Prompts AI assistant to help decide |
| Hosting        | Cloudflare Pages        | Best free tier for static sites     |

The generated spec includes notes explaining each defaulted value so the user (or their AI assistant) understands the assumption.

## Personas

Two personas affect the question flow:

- **Developer** — sees technical language, full option descriptions
- **New builder** — sees simplified wording, some questions auto-default

Personas affect question text and defaults but not the spec output. Both personas generate identical specs for identical answers.

## Spec Sections

Every generated spec includes these sections (some conditional):

| Section                       | Always | Conditional on                                 |
| ----------------------------- | ------ | ---------------------------------------------- |
| Meta                          | Yes    | —                                              |
| Summary                       | Yes    | —                                              |
| User Customizations           | —      | Stack customization text provided              |
| Idea                          | Yes    | —                                              |
| Architecture (Data & Caching) | —      | External data source selected                  |
| Architecture (Infrastructure) | Yes    | —                                              |
| Architecture (APIs)           | —      | API description or name provided               |
| Architecture (Libraries)      | —      | Standard/full tier + relevant data patterns    |
| Architecture (User Input)     | —      | User content data source selected              |
| Design Decisions              | Yes    | —                                              |
| UX States                     | Yes    | —                                              |
| Wiring Guide (Data Flow)      | Yes    | —                                              |
| Wiring Guide (Trust Boundary) | —      | Worker proxy or user content                   |
| Wiring Guide (Secrets)        | —      | Worker proxy needed                            |
| Pre-Ship Checklist            | Yes    | —                                              |
| Web Standards                 | Yes    | —                                              |
| Content Security Policy       | Yes    | —                                              |
| Accessibility & Responsive    | Yes    | —                                              |
| Locale & Internationalization | Yes    | —                                              |
| Configuration Checklist       | Yes    | —                                              |
| Free Tier Budget              | —      | External data or public scale                  |
| Agentic Research Notes        | —      | External data, unsure hosting, or unsure scale |
| Implementation Order          | Yes    | —                                              |
| Deployment                    | Yes    | —                                              |
| Post-Deployment               | Yes    | —                                              |
| Suggested Prompt              | Yes    | —                                              |

## The Suggested Prompt

Every spec ends with a copy-paste prompt designed for AI coding assistants. It asks the assistant to:

1. Review and confirm understanding of the architecture
2. Ask clarifying questions before starting
3. Build step by step, starting with the HTML shell
4. Follow the implementation order
5. Complete the pre-ship checklist before deployment
6. Help through configuration and deployment

The prompt turns the spec from a reference into a build plan.
