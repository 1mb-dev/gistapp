import { INSIGHTS_URL } from './config';

export function track(event: string, data: Record<string, string | number | undefined> = {}): void {
  try {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    const blob = new Blob([JSON.stringify({ event, ...data })], { type: 'text/plain' });
    const queued = navigator.sendBeacon(`${INSIGHTS_URL}/api/event`, blob);
    if (!queued && import.meta.env.DEV) {
      console.warn('[insights] sendBeacon returned false — beacon was not queued');
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[insights] track() failed:', err);
    }
    /* silent in production — tracking is non-critical */
  }
}

export interface QuestionAbandonedState {
  /** ID of the question the user was last shown, or null if they are not
   *  currently on a question screen (persona selection, stack confirm, post-spec). */
  currentQuestionId: string | null;
  persona: string;
  stepIndex: number;
  /** True if the user has clicked "Generate spec" — flow completed successfully,
   *  no abandonment event should fire on tab close. */
  userReachedSpec: boolean;
}

/**
 * Decide whether to fire a `question_abandoned` beacon and, if so, send it.
 * Returns true if a beacon was queued. Extracted from the page handler so the
 * fire path is unit-testable in jsdom without mounting Astro.
 */
export function fireQuestionAbandoned(
  state: QuestionAbandonedState,
  sendBeaconFn: (url: string, data: Blob | string) => boolean,
  beaconUrl: string = `${INSIGHTS_URL}/api/event`,
): boolean {
  if (!state.currentQuestionId) return false;
  if (state.userReachedSpec) return false;
  const payload = JSON.stringify({
    event: 'question_abandoned',
    questionId: state.currentQuestionId,
    persona: state.persona,
    stepIndex: state.stepIndex,
  });
  const blob = new Blob([payload], { type: 'text/plain' });
  return sendBeaconFn(beaconUrl, blob);
}
