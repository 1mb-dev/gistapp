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
