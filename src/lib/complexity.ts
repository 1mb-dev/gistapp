import type { ComplexityTier, UserAnswers } from './types';

/**
 * Determine the architecture complexity tier based on user answers.
 *
 * Default to minimal. Scale up only when answers demand it.
 * This prevents the dry-run problem: every app getting maximum infrastructure.
 */
export function determineComplexity(answers: Partial<UserAnswers>): ComplexityTier {
  const { dataSource, dataFreshness, scale, pageCount, userInputType } = answers;

  // Full tier: multi-page + keyed API + public + cron
  if (pageCount === 'many' && scale === 'public') {
    return 'full';
  }
  if (dataFreshness === 'hourly' && scale === 'public') {
    return 'full';
  }

  // Standard tier: needs a Worker (keyed API or CORS proxy) or moderate complexity
  if (userInputType === 'user-saves-data') {
    return 'standard';
  }
  if (scale === 'public' && dataSource === 'public-api') {
    return 'standard';
  }
  if (pageCount === 'many') {
    return 'standard';
  }
  if (pageCount === 'few' && dataSource === 'public-api' && scale !== 'personal') {
    return 'standard';
  }

  // Everything else: minimal
  return 'minimal';
}

/** Human-readable description of each tier */
export const tierDescriptions: Record<ComplexityTier, {
  label: string;
  framework: string;
  description: string;
  components: string[];
}> = {
  minimal: {
    label: 'Minimal',
    framework: 'Plain HTML, CSS, and JavaScript',
    description: 'No framework, no build step, no server. Deploy static files directly.',
    components: ['Static HTML/CSS/JS', 'Hosted on your chosen platform'],
  },
  standard: {
    label: 'Standard',
    framework: 'Astro (static site generator)',
    description: 'Framework for multi-page routing, plus a Worker if your API needs a proxy.',
    components: [
      'Astro static site',
      'Cloudflare Worker (API proxy)',
      'GitHub Actions (CI/CD)',
    ],
  },
  full: {
    label: 'Full',
    framework: 'Astro + Cloudflare Workers + KV',
    description: 'Full infrastructure with caching, scheduled updates, and API proxy.',
    components: [
      'Astro static site',
      'Cloudflare Worker (API proxy + cache writer)',
      'Cloudflare KV (data cache)',
      'GitHub Actions (CI/CD + hourly cron)',
    ],
  },
};

/** Determine if a Worker proxy is needed based on answers */
export function needsWorkerProxy(answers: Partial<UserAnswers>): boolean {
  // If API is explicitly known to be free/keyless, no proxy needed
  // This is a heuristic — the spec will note research is needed if unsure
  if (answers.dataSource !== 'public-api' && answers.dataSource !== 'rss') {
    return false;
  }
  // Public scale with API = likely needs caching proxy
  if (answers.scale === 'public') return true;
  // If user named an API that commonly requires a key, suggest proxy
  // (The spec generator will add a research note for Claude to verify)
  return false;
}

/** Determine if cron/scheduled updates are needed */
export function needsCron(answers: Partial<UserAnswers>): boolean {
  return answers.dataFreshness === 'hourly' && answers.scale !== 'personal';
}

/** Determine if PWA features should be recommended */
export function shouldRecommendPWA(answers: Partial<UserAnswers>): boolean {
  return answers.usageFrequency === 'daily' &&
    (answers.deviceTarget === 'phone' || answers.deviceTarget === 'both');
}
