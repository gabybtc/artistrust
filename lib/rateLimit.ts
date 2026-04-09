/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Good enough to protect against runaway clients and buggy loops on a
 * single-instance deployment. For multi-instance (Vercel edge scale-out),
 * each instance enforces its own window, so effective throughput per user
 * across all instances is higher — but it still prevents single-client
 * hammering on one instance.
 *
 * Usage:
 *   const limiter = new RateLimiter(10, 60_000)   // 10 req / 60 s
 *   const ok = limiter.check(ip)
 *   if (!ok) return NextResponse.json({ error: 'rate_limit' }, { status: 429 })
 */
export class RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly store = new Map<string, number[]>()
  // Prune stale keys every N checks to avoid unbounded memory growth
  private checkCount = 0
  private readonly pruneEvery = 500

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  check(key: string): boolean {
    const now = Date.now()
    const cutoff = now - this.windowMs
    const timestamps = (this.store.get(key) ?? []).filter(t => t > cutoff)
    if (timestamps.length >= this.limit) return false
    timestamps.push(now)
    this.store.set(key, timestamps)
    this.maybeprune(now)
    return true
  }

  private maybeprune(now: number): void {
    if (++this.checkCount < this.pruneEvery) return
    this.checkCount = 0
    const cutoff = now - this.windowMs
    for (const [key, ts] of this.store) {
      if (ts[ts.length - 1] < cutoff) this.store.delete(key)
    }
  }
}
