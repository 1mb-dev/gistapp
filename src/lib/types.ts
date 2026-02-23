/** Persona selected at the start of the form */
export type Persona = 'new-builder' | 'developer';

/** Architecture complexity tier determined by the complexity router */
export type ComplexityTier = 'minimal' | 'standard' | 'full';

/** Data source categories from Q3 */
export type DataSource =
  | 'public-api'
  | 'rss'
  | 'static-file'
  | 'no-external'
  | 'user-content'
  | 'other'
  | 'unsure';

/** Data freshness from Q4 */
export type DataFreshness = 'realtime' | 'hourly' | 'daily' | 'static' | 'unsure';

/** Expected scale from Q5 */
export type Scale = 'personal' | 'friends' | 'public' | 'unsure';

/** User input type from Q6a */
export type UserInputType = 'simple-form' | 'user-saves-data' | 'display-only';

/** Hosting platform from Q7 */
export type HostingPlatform = 'cloudflare-pages' | 'github-pages' | 'vercel' | 'netlify' | 'unsure';

/** Design vibe from Q8 */
export type DesignVibe = 'calm' | 'bold' | 'professional' | 'playful' | 'other';

/** Information density from Q8 */
export type InfoDensity = 'hero' | 'organized' | 'dense';

/** Page count category from Q9 */
export type PageCount = 'single' | 'few' | 'many' | 'unsure';

/** Offline preference from Q10 */
export type OfflineSupport = 'yes' | 'no' | 'unsure';

/** Usage frequency from Q2 */
export type UsageFrequency = 'daily' | 'weekly' | 'event-driven' | 'one-time';

/** Device preference from Q2 */
export type DeviceTarget = 'phone' | 'desktop' | 'both' | 'unsure';

/** Complete set of user answers driving spec generation */
export interface UserAnswers {
  persona: Persona;

  // Q1 — Product brief
  title: string;
  description: string;
  headlineValue: string;

  // Q2 — Audience
  audience: string;
  usageFrequency: UsageFrequency;
  deviceTarget: DeviceTarget;

  // Q3 — Data source
  dataSource: DataSource;
  dataSourceDetail?: string;

  // Q4 — Data freshness (only if external data)
  dataFreshness?: DataFreshness;

  // Q5 — Scale
  scale: Scale;

  // Q6 — APIs (only if external data)
  apiDescription?: string;
  apiKnownName?: string;

  // Q6a — User input (only if user-content)
  userInputType?: UserInputType;

  // Q7 — Hosting
  hosting: HostingPlatform;

  // Q8 — Design (optional)
  designVibe?: DesignVibe;
  designVibeCustom?: string;
  infoDensity?: InfoDensity;

  // Q9 — Page count
  pageCount: PageCount;

  // Q10 — Offline (conditional)
  offlineSupport?: OfflineSupport;

  // Q11 — Stack confirmation
  stackConfirmed: boolean;
  stackCustomizations?: string;
}

/** A single option displayed on the platter */
export interface QuestionOption {
  id: string;
  label: string;
  detail?: string;
  freeInput?: boolean;
  freeInputKey?: keyof UserAnswers;
}

/** Response modes for a question */
export type ResponseMode = 'pick-one' | 'multi-field';

/** Definition of a single question in the flow */
export interface QuestionDef {
  id: string;
  title: string;
  subtitle?: string;
  responseMode: ResponseMode;
  options?: QuestionOption[];
  fields?: QuestionField[];
  optional?: boolean;
  /** Returns true if this question should be shown given current answers */
  condition?: (answers: Partial<UserAnswers>) => boolean;
}

/** A text field within a multi-field question (e.g. Q1) */
export interface QuestionField {
  key: keyof UserAnswers;
  label: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
}

/** Per-question text overrides for a persona */
export interface PersonaOverlay {
  title?: string;
  subtitle?: string;
  options?: Record<string, { label?: string; detail?: string }>;
  autoDefault?: string;
}

/** Generated spec metadata */
export interface SpecMeta {
  gistVersion: string;
  generated: string;
  persona: Persona;
  complexityTier: ComplexityTier;
}
