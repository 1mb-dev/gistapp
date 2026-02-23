import { INSIGHTS_URL } from './config';

export function track(event: string, data: Record<string, string | number | undefined> = {}): void {
  try {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return;
    const blob = new Blob([JSON.stringify({ event, ...data })], { type: 'text/plain' });
    navigator.sendBeacon(`${INSIGHTS_URL}/api/event`, blob);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[insights] track() failed:', err);
    }
    /* silent in production — tracking is non-critical */
  }
}
