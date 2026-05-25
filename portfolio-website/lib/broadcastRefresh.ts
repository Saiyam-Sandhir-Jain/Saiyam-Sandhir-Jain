/**
 * Broadcasts a refresh signal to all portfolio tabs open in the same browser.
 * Call this from any admin component after a successful save.
 * The portfolio HomeClient listens via BroadcastChannel and calls router.refresh()
 * to re-fetch server data in-place — no full page reload.
 */
export function broadcastPortfolioRefresh() {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const ch = new BroadcastChannel('portfolio-updates')
      ch.postMessage({ type: 'refresh', ts: Date.now() })
      ch.close()
    }
  } catch {
    // BroadcastChannel unavailable in some environments — silently ignore
  }
}
