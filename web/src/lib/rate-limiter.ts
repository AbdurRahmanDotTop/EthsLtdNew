/**
 * Server-Side Sliding Window Rate Limiter
 * ETHSLTD Security Suite
 */

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

// In-memory bucket store
const rateLimitStore = new Map<string, RateLimitRecord>();

function cleanupExpiredEntries(now: number) {
  if (rateLimitStore.size < 200) return;
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.lastRequestTime > 3600 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitOptions {
  windowSeconds: number; // e.g. 900 for 15 minutes
  maxRequests: number;   // e.g. 5 requests allowed in that window
  minCooldownSeconds?: number; // e.g. 60 seconds minimum between consecutive requests
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  error?: string;
}

/**
 * Checks and increments rate limit for a specific action key (e.g., "register:192.168.1.1").
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitCheckResult {
  const now = Date.now();
  cleanupExpiredEntries(now);
  const windowMs = options.windowSeconds * 1000;
  const minCooldownMs = (options.minCooldownSeconds || 0) * 1000;

  const record = rateLimitStore.get(key);

  if (!record) {
    rateLimitStore.set(key, {
      count: 1,
      firstRequestTime: now,
      lastRequestTime: now,
    });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      retryAfterSeconds: 0,
    };
  }

  // Check if current window has expired
  if (now - record.firstRequestTime > windowMs) {
    // Reset window
    rateLimitStore.set(key, {
      count: 1,
      firstRequestTime: now,
      lastRequestTime: now,
    });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      retryAfterSeconds: 0,
    };
  }

  // Check minimum cooldown if configured
  if (minCooldownMs > 0 && now - record.lastRequestTime < minCooldownMs) {
    const cooldownRemaining = Math.ceil((minCooldownMs - (now - record.lastRequestTime)) / 1000);
    return {
      allowed: false,
      remaining: Math.max(0, options.maxRequests - record.count),
      retryAfterSeconds: cooldownRemaining,
      error: `Please wait ${cooldownRemaining} seconds before trying again.`,
    };
  }

  // Check maximum requests limit
  if (record.count >= options.maxRequests) {
    const windowRemaining = Math.ceil((windowMs - (now - record.firstRequestTime)) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: windowRemaining,
      error: `Too many attempts. Rate limit exceeded. Please wait ${windowRemaining} seconds before retrying.`,
    };
  }

  // Increment count
  record.count += 1;
  record.lastRequestTime = now;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: options.maxRequests - record.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Reset rate limit counter for a key upon successful verified action
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Helper to safely extract client IP from incoming Next.js request headers
 */
export function getClientIp(headersList: { get: (name: string) => string | null }): string {
  const cfConnectingIp = headersList.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = headersList.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = headersList.get("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",");
    if (ips[0]) return ips[0].trim();
  }

  return "127.0.0.1";
}
