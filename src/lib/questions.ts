import type { QuestionDef, UserAnswers, Persona, PersonaOverlay } from './types';

/** Returns true if the user selected an external data source */
function hasExternalData(answers: Partial<UserAnswers>): boolean {
  const src = answers.dataSource;
  return src === 'public-api' || src === 'rss' || src === 'static-file' || src === 'other';
}

/** Returns true if the user selected user-generated content */
function hasUserContent(answers: Partial<UserAnswers>): boolean {
  return answers.dataSource === 'user-content';
}

/** Returns true if the user's audience suggests mobile/daily use */
function isDailyMobile(answers: Partial<UserAnswers>): boolean {
  return (
    answers.usageFrequency === 'daily' &&
    (answers.deviceTarget === 'phone' || answers.deviceTarget === 'both')
  );
}

export const questions: QuestionDef[] = [
  // Q1 — Product brief
  {
    id: 'product-brief',
    title: 'What are you building?',
    subtitle: 'Give your app a name and describe what it does in one sentence.',
    responseMode: 'multi-field',
    fields: [
      {
        key: 'title',
        label: 'App name',
        placeholder: 'Weather Now',
        required: true,
      },
      {
        key: 'description',
        label: 'One-sentence description',
        placeholder: 'A clutter-free weather app for my current location',
        required: true,
      },
      {
        key: 'headlineValue',
        label: 'What does the user see in 5 seconds?',
        placeholder: 'Current temperature and 7-day forecast',
        required: true,
      },
    ],
  },

  // Q2 — Audience
  {
    id: 'audience',
    title: 'Who uses this?',
    subtitle: "Tell us about your users and how they'll interact with the app.",
    responseMode: 'multi-field',
    fields: [
      {
        key: 'audience',
        label: 'Who is it for?',
        placeholder: 'Commuters, weather enthusiasts, everyone',
        required: true,
      },
    ],
  },
  {
    id: 'usage-frequency',
    title: 'How often will people use it?',
    responseMode: 'pick-one',
    options: [
      {
        id: 'daily',
        label: 'Daily habit',
        detail: 'Used every day — think weather, news, fitness',
      },
      { id: 'weekly', label: 'Weekly check-in', detail: 'Checked once a week or so' },
      {
        id: 'event-driven',
        label: 'When needed',
        detail: 'Used when something happens — a calculator, converter',
      },
      { id: 'one-time', label: 'One-time use', detail: 'Used once and done — an event page, form' },
    ],
  },
  {
    id: 'device-target',
    title: 'Where will people use it?',
    responseMode: 'pick-one',
    options: [
      { id: 'phone', label: 'Phone first', detail: 'Optimized for mobile — great for daily apps' },
      {
        id: 'desktop',
        label: 'Desktop first',
        detail: 'Best on a larger screen — dashboards, tools',
      },
      { id: 'both', label: 'Both', detail: 'Works equally well on phone and desktop' },
      { id: 'unsure', label: "I'm not sure", detail: "We'll make it work everywhere" },
    ],
  },

  // Q3 — Data source
  {
    id: 'data-source',
    title: 'Where does the data come from?',
    subtitle: 'This determines how your app gets and displays information.',
    responseMode: 'pick-one',
    options: [
      { id: 'public-api', label: 'Public API', detail: 'Weather, stocks, news, maps, etc.' },
      { id: 'rss', label: 'RSS feed', detail: 'Blog posts, podcasts, news feeds' },
      { id: 'static-file', label: 'Static file', detail: 'A JSON, CSV, or data file you provide' },
      {
        id: 'no-external',
        label: 'No external data',
        detail: 'Calculator, portfolio, landing page, tool',
      },
      {
        id: 'user-content',
        label: 'Users create the content',
        detail: 'Forms, submissions, user-generated',
      },
      { id: 'unsure', label: "I'm not sure", detail: "We'll keep things flexible" },
      {
        id: 'other',
        label: 'Other',
        freeInput: true,
        freeInputKey: 'dataSourceDetail',
        detail: 'Describe your data source',
      },
    ],
  },

  // Q4 — Data freshness (only if external data)
  {
    id: 'data-freshness',
    title: 'How often does the data change?',
    subtitle: 'This determines whether we need caching, cron jobs, or direct fetch.',
    responseMode: 'pick-one',
    condition: hasExternalData,
    options: [
      {
        id: 'realtime',
        label: 'Real-time',
        detail:
          'Fetch fresh data on each request — counts against rate limits (most APIs: 500–1K/day free)',
      },
      {
        id: 'hourly',
        label: 'Hourly',
        detail: 'Updates every hour (~720 API calls/month) — cron job + cache keeps it fast',
      },
      {
        id: 'daily',
        label: 'Daily or less',
        detail: 'Updates once a day (~30 API calls/month) — bake into the build',
      },
      { id: 'static', label: 'Never', detail: "Data doesn't change — fetch once, cache forever" },
      { id: 'unsure', label: "I'm not sure", detail: "We'll recommend a safe default" },
    ],
  },

  // Q5 — Scale
  {
    id: 'scale',
    title: 'How many people will use this?',
    subtitle: 'A personal tool needs different infrastructure than a public app.',
    responseMode: 'pick-one',
    options: [
      { id: 'personal', label: 'Just me', detail: 'Personal tool — simplest setup' },
      { id: 'friends', label: 'Me and friends', detail: 'Under 100 users — still simple' },
      {
        id: 'public',
        label: 'Public',
        detail: '100+ users — may need caching (most free CDNs handle this fine)',
      },
      { id: 'unsure', label: "I'm not sure", detail: "We'll recommend a setup that can grow" },
    ],
  },

  // Q6 — APIs (only if external data)
  {
    id: 'api-details',
    title: 'What data do you need?',
    subtitle: 'Describe it in plain language. Your AI assistant will research the best API.',
    responseMode: 'multi-field',
    condition: hasExternalData,
    fields: [
      {
        key: 'apiDescription',
        label: 'What data does your app need?',
        placeholder: 'Current weather, temperature, humidity, and 7-day forecast',
        required: true,
        multiline: true,
      },
      {
        key: 'apiKnownName',
        label: 'Know a specific API? (optional)',
        placeholder: 'Open-Meteo, OpenWeather, etc.',
      },
    ],
  },

  // Q6a — User input (only if user-content)
  {
    id: 'user-input',
    title: 'Does anyone submit or save information?',
    responseMode: 'pick-one',
    condition: hasUserContent,
    options: [
      { id: 'simple-form', label: 'Simple form', detail: 'Contact, feedback, newsletter signup' },
      {
        id: 'user-saves-data',
        label: 'Users save data',
        detail: 'Accounts, preferences, entries — needs storage',
      },
      {
        id: 'display-only',
        label: 'Display only',
        detail: 'Content is pre-loaded, users just view it',
      },
    ],
  },

  // Q7 — Hosting
  {
    id: 'hosting',
    title: 'Where should it be hosted?',
    subtitle: 'All options are free tier. Pick what you know, or let your AI assistant decide.',
    responseMode: 'pick-one',
    options: [
      {
        id: 'cloudflare-pages',
        label: 'Cloudflare Pages',
        detail: 'Free: unlimited bandwidth, 500 builds/month, global CDN',
      },
      {
        id: 'github-pages',
        label: 'GitHub Pages',
        detail: 'Free: 100 GB bandwidth/month, simple deploy from repo',
      },
      {
        id: 'vercel',
        label: 'Vercel',
        detail: 'Free: 100 GB bandwidth/month, great developer experience',
      },
      {
        id: 'netlify',
        label: 'Netlify',
        detail: 'Free: 100 GB bandwidth/month, form handling built in',
      },
      {
        id: 'unsure',
        label: "I'm not sure",
        detail: 'The spec will include a comparison for your AI assistant',
      },
    ],
  },

  // Q8 — Design vibe (optional)
  {
    id: 'design-vibe',
    title: "What's the vibe?",
    subtitle:
      "Pick the feel that fits your app. Skip this if you're not sure — we'll use sensible defaults.",
    responseMode: 'pick-one',
    optional: true,
    options: [
      {
        id: 'calm',
        label: 'Calm and minimal',
        detail: 'Whitespace, muted colors, breathable layout',
      },
      { id: 'bold', label: 'Bold and vibrant', detail: 'Strong colors, high contrast, energetic' },
      {
        id: 'professional',
        label: 'Professional and clean',
        detail: 'Structured, corporate-friendly, clear hierarchy',
      },
      {
        id: 'playful',
        label: 'Playful and fun',
        detail: 'Rounded corners, bright accents, personality',
      },
      {
        id: 'other',
        label: 'Something else',
        freeInput: true,
        freeInputKey: 'designVibeCustom',
        detail: 'Describe the vibe in your words',
      },
    ],
  },
  {
    id: 'info-density',
    title: 'How much information on screen?',
    responseMode: 'pick-one',
    optional: true,
    options: [
      {
        id: 'hero',
        label: 'One big thing',
        detail: 'Hero layout — one number, one message, glanceable',
      },
      {
        id: 'organized',
        label: 'A few things, organized',
        detail: 'Cards, sections, clear structure',
      },
      { id: 'dense', label: 'Lots of data', detail: 'Dashboard, tables, data-rich' },
    ],
  },

  // Q9 — Page count
  {
    id: 'page-count',
    title: 'How many screens does your app have?',
    subtitle: 'This helps us decide whether you need a framework or just plain HTML.',
    responseMode: 'pick-one',
    options: [
      {
        id: 'single',
        label: 'One screen',
        detail: 'Single-purpose — the whole app fits on one page',
      },
      { id: 'few', label: 'A few pages', detail: '2-5 pages with navigation' },
      { id: 'many', label: 'Many pages', detail: 'Content site, documentation, blog' },
      { id: 'unsure', label: "I'm not sure", detail: "We'll start with one page" },
    ],
  },

  // Q10 — Offline (conditional on daily + mobile)
  {
    id: 'offline',
    title: 'Should it work without internet?',
    subtitle: 'Since this is a daily mobile app, offline support could be useful.',
    responseMode: 'pick-one',
    condition: isDailyMobile,
    options: [
      { id: 'yes', label: 'Yes', detail: 'Show last-known data when offline' },
      { id: 'no', label: 'No', detail: 'Internet is required to use the app' },
      {
        id: 'unsure',
        label: 'Not sure',
        detail: 'The spec will note it as a future consideration',
      },
    ],
  },
];

/** Get the subset of questions that should be shown given current answers */
export function getVisibleQuestions(answers: Partial<UserAnswers>): QuestionDef[] {
  return questions.filter((q) => !q.condition || q.condition(answers));
}

/** Persona overlay map: jargon-free text for new-builder persona */
const newBuilderOverlays: Record<string, PersonaOverlay> = {
  'data-source': {
    title: 'Where does your app get its information?',
    subtitle: 'Most apps show information from somewhere. Pick what fits.',
    options: {
      'public-api': {
        label: 'From the internet',
        detail: 'Weather, news, stock prices, maps, etc.',
      },
      rss: { label: 'From a blog or news feed', detail: 'Blog posts, podcasts, news updates' },
      'static-file': {
        label: 'From a file I provide',
        detail: 'A spreadsheet, list, or data file you already have',
      },
      'no-external': {
        label: 'No outside information',
        detail: 'Calculator, portfolio, landing page, tool',
      },
      'user-content': {
        label: 'People using the app add it',
        detail: 'Forms, submissions, user-generated content',
      },
      unsure: { label: "I'm not sure", detail: "That's okay — we'll keep things flexible" },
    },
  },
  'data-freshness': {
    title: 'How often does the information update?',
    subtitle: 'This helps us decide how your app fetches data.',
    autoDefault: 'daily',
    options: {
      realtime: {
        label: 'Constantly',
        detail: 'Always showing the latest — like a live score or stock ticker',
      },
      hourly: { label: 'Every hour', detail: 'Refreshes in the background so it stays current' },
      daily: {
        label: 'Once a day or less',
        detail: 'Updates occasionally — news, blog posts, daily stats',
      },
      static: { label: 'It never changes', detail: 'The information stays the same forever' },
      unsure: { label: "I'm not sure", detail: "We'll pick a safe default (once a day)" },
    },
  },
  'device-target': {
    title: 'Where will people use your app?',
    autoDefault: 'both',
    options: {
      phone: { label: 'On their phone', detail: 'Designed for small screens first' },
      desktop: {
        label: 'On a computer',
        detail: 'Designed for larger screens — dashboards, tools',
      },
      both: { label: 'Both phone and computer', detail: 'Works great on any screen size' },
      unsure: { label: "I'm not sure", detail: "We'll make it work everywhere" },
    },
  },
  scale: {
    autoDefault: 'personal',
    options: {
      personal: { label: 'Just me', detail: 'A personal tool — simplest setup' },
      friends: { label: 'Me and a few friends', detail: 'A small group — still simple' },
      public: { label: 'Anyone on the internet', detail: 'Open to everyone' },
      unsure: { label: "I'm not sure yet", detail: "We'll start simple — you can scale up later" },
    },
  },
  hosting: {
    title: 'Where should your app live on the internet?',
    subtitle: "All options are free. If you don't know, we'll pick one for you.",
    autoDefault: 'unsure',
  },
  'page-count': {
    title: 'How many screens does your app need?',
    subtitle: 'Think of screens as separate pages people can visit.',
    autoDefault: 'single',
    options: {
      single: { label: 'Just one screen', detail: 'Everything fits on a single page' },
      few: { label: 'A few screens', detail: '2–5 pages people can navigate between' },
      many: { label: 'Lots of screens', detail: 'Many pages — like a blog or documentation site' },
      unsure: {
        label: "I'm not sure",
        detail: "We'll start with one page — you can add more later",
      },
    },
  },
  'usage-frequency': {
    title: 'How often will people use your app?',
    options: {
      daily: { label: 'Every day', detail: 'A daily habit — like checking the weather' },
      weekly: { label: 'Once a week', detail: 'Checked occasionally throughout the week' },
      'event-driven': {
        label: 'When they need it',
        detail: 'Used for a specific task — a calculator, converter',
      },
      'one-time': { label: 'Just once', detail: 'Used once and done — an event page, signup form' },
    },
  },
  'info-density': {
    title: 'How much should your app show at once?',
    options: {
      hero: { label: 'One big thing', detail: 'A single number or message, easy to glance at' },
      organized: {
        label: 'A few things, neatly arranged',
        detail: 'Cards or sections with clear labels',
      },
      dense: { label: 'Lots of information', detail: 'Tables, charts, or data-heavy displays' },
    },
  },
};

/** Resolve a question definition with persona-specific overlays */
export function resolveQuestion(q: QuestionDef, persona?: Persona): QuestionDef {
  if (persona !== 'new-builder') return q;

  const overlay = newBuilderOverlays[q.id];
  if (!overlay) return q;

  const resolved: QuestionDef = {
    ...q,
    title: overlay.title ?? q.title,
    subtitle: overlay.subtitle ?? q.subtitle,
  };

  if (overlay.options && q.options) {
    resolved.options = q.options.map((opt) => {
      const ov = overlay.options![opt.id];
      if (!ov) return opt;
      return {
        ...opt,
        label: ov.label ?? opt.label,
        detail: ov.detail ?? opt.detail,
      };
    });
  }

  return resolved;
}

/** Get the auto-default option ID for a question/persona pair */
export function getAutoDefault(questionId: string, persona?: Persona): string | undefined {
  if (persona !== 'new-builder') return undefined;
  return newBuilderOverlays[questionId]?.autoDefault;
}

/** Map a question option ID to the corresponding UserAnswers key and value */
export function mapOptionToAnswer(
  questionId: string,
  optionId: string,
): { key: keyof UserAnswers; value: string } | null {
  const mapping: Record<string, keyof UserAnswers> = {
    'usage-frequency': 'usageFrequency',
    'device-target': 'deviceTarget',
    'data-source': 'dataSource',
    'data-freshness': 'dataFreshness',
    scale: 'scale',
    'user-input': 'userInputType',
    hosting: 'hosting',
    'design-vibe': 'designVibe',
    'info-density': 'infoDensity',
    'page-count': 'pageCount',
    offline: 'offlineSupport',
  };

  const key = mapping[questionId];
  if (!key) return null;

  return { key, value: optionId };
}
