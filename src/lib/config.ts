/** Must stay in lockstep with the `connect-src` allowlist in `public/_headers`. Changing one
 *  without the other leaves the CSP blocking every beacon and share fetch — and both fail
 *  quietly, since sendBeacon is fire-and-forget and the share fetch falls back gracefully.
 *
 *  A custom domain rather than the worker's `*.workers.dev` hostname on purpose: that subdomain
 *  is derived from the Cloudflare account, so the previous value (gist-483.workers.dev) would
 *  have silently broken on the account migration. */
export const INSIGHTS_URL = 'https://gist-insights.1mb.dev';
