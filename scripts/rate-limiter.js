/**
 * Simple rate limiter using token bucket algorithm.
 * Usage:
 *   const limiter = new RateLimiter(40, 10000); // 40 requests per 10 seconds
 *   await limiter.wait();
 *   // make API call
 */
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamps = [];
  }

  async wait() {
    while (true) {
      const now = Date.now();
      // Remove timestamps outside the window
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

      if (this.timestamps.length < this.maxRequests) {
        this.timestamps.push(now);
        return;
      }

      // Wait until the oldest timestamp expires
      const oldest = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldest) + 50; // 50ms buffer
      await new Promise((r) => setTimeout(r, waitTime));
    }
  }
}

module.exports = { RateLimiter };
