/** Chrome stops an idle extension service worker after 30s; extension API calls reset that timer. */
export const KEEPALIVE_MS = 20_000;

/** Calls `ping` periodically (e.g. a cheap extension API) to keep the worker alive during long requests. */
export function keepAlive(ping: () => Promise<unknown>, intervalMs = KEEPALIVE_MS): () => void {
  const id = setInterval(() => void ping().catch(() => {}), intervalMs);
  return () => clearInterval(id);
}
