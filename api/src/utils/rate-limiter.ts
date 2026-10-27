/**
 * Sliding Window Rate Limiter for Cloudflare Workers API
 * ETHSLTD Security Suite (Worker / API)
 */

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  minCooldownSeconds?: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  error?: string;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitCheckResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  const minCooldownMs = (options.minCooldownSeconds || 0) * 1000;

  // Cleanup old records periodically
  if (rateLimitStore.size > 2000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now - v.lastRequestTime > 3600 * 1000) {
        rateLimitStore.delete(k);
      }
    }
  }

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

  if (now - record.firstRequestTime > windowMs) {
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

  if (minCooldownMs > 0 && now - record.lastRequestTime < minCooldownMs) {
    const cooldownRemaining = Math.ceil((minCooldownMs - (now - record.lastRequestTime)) / 1000);
    return {
      allowed: false,
      remaining: Math.max(0, options.maxRequests - record.count),
      retryAfterSeconds: cooldownRemaining,
      error: `Please wait ${cooldownRemaining} seconds before trying again.`,
    };
  }

  if (record.count >= options.maxRequests) {
    const windowRemaining = Math.ceil((windowMs - (now - record.firstRequestTime)) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: windowRemaining,
      error: `Too many attempts. Rate limit exceeded. Please wait ${windowRemaining} seconds before retrying.`,
    };
  }

  record.count += 1;
  record.lastRequestTime = now;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: options.maxRequests - record.count,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

export function getClientIp(req: { header: (name: string) => string | undefined }): string {
  const cfConnectingIp = req.header("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = req.header("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = req.header("x-forwarded-for");
  if (xForwardedFor) {
    const ips = xForwardedFor.split(",");
    if (ips[0]) return ips[0].trim();
  }

  return "127.0.0.1";
}
