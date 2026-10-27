import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const PRODUCTION_DOMAIN = "https://ethsltd.com";
export const LOCAL_DEV_DOMAIN = "http://localhost:3000";

/**
 * Clean and normalize a base URL string.
 */
export function normalizeBaseUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return null;
  }
  return trimmed;
}

/**
 * Determine if current runtime execution is in production or deployed on Cloudflare.
 */
export function isProductionEnvironment(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.CF_PAGES === "1") return true;
  // If running inside Cloudflare Worker
  try {
    const cf = getCloudflareContext({ async: false });
    if (cf?.env) return true;
  } catch {}
  return false;
}

/**
 * Synchronously resolve the application base URL.
 * Guarantees that in production, localhost is NEVER returned.
 */
export function getAppUrlSync(fallbackOrigin?: string): string {
  const isProd = isProductionEnvironment();

  // 1. Explicit caller-provided origin (e.g. from client window.location.origin)
  if (fallbackOrigin) {
    const normalized = normalizeBaseUrl(fallbackOrigin);
    if (normalized) {
      if (isProd && normalized.includes("localhost")) {
        return PRODUCTION_DOMAIN;
      }
      return normalized;
    }
  }

  // 2. Cloudflare Context bindings (wrangler.jsonc vars)
  try {
    const cf = getCloudflareContext({ async: false });
    const cfEnv = cf?.env as Record<string, string> | undefined;
    const cfUrl = normalizeBaseUrl(cfEnv?.APP_URL || cfEnv?.NEXT_PUBLIC_APP_URL);
    if (cfUrl) {
      if (isProd && cfUrl.includes("localhost")) {
        return PRODUCTION_DOMAIN;
      }
      return cfUrl;
    }
  } catch {}

  // 3. Process ENV variables
  const envAppUrl = normalizeBaseUrl(process.env.APP_URL);
  if (envAppUrl) {
    if (isProd && envAppUrl.includes("localhost")) {
      return PRODUCTION_DOMAIN;
    }
    return envAppUrl;
  }

  const envPublicUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (envPublicUrl) {
    if (isProd && envPublicUrl.includes("localhost")) {
      return PRODUCTION_DOMAIN;
    }
    return envPublicUrl;
  }

  // 4. Default by environment
  return isProd ? PRODUCTION_DOMAIN : LOCAL_DEV_DOMAIN;
}

/**
 * Asynchronously resolve the base URL using incoming HTTP request headers if available.
 * If running in a Server Action or Route Handler, this accurately captures the exact domain
 * the client accessed (e.g., https://ethsltd.com or https://www.ethsltd.com).
 */
export async function getAppUrl(
  passedHeaders?: Headers | null,
  fallbackOrigin?: string
): Promise<string> {
  const isProd = isProductionEnvironment();

  // 1. Check explicit fallback origin first
  if (fallbackOrigin) {
    const normalized = normalizeBaseUrl(fallbackOrigin);
    if (normalized) {
      if (isProd && normalized.includes("localhost")) {
        return PRODUCTION_DOMAIN;
      }
      return normalized;
    }
  }

  // 2. Try to inspect HTTP request headers
  let reqHeaders = passedHeaders;
  if (!reqHeaders) {
    try {
      reqHeaders = await headers();
    } catch {
      // In background tasks, scripts, or outside request context
      reqHeaders = null;
    }
  }

  if (reqHeaders) {
    // Check 'origin' header
    const originHeader = normalizeBaseUrl(reqHeaders.get("origin"));
    if (originHeader) {
      if (isProd && originHeader.includes("localhost")) {
        return PRODUCTION_DOMAIN;
      }
      return originHeader;
    }

    // Check host headers
    const hostHeader = reqHeaders.get("x-forwarded-host") || reqHeaders.get("host");
    if (hostHeader && typeof hostHeader === "string") {
      const cleanHost = hostHeader.split(",")[0].trim();
      const protoHeader = reqHeaders.get("x-forwarded-proto");
      const proto =
        protoHeader === "http" || cleanHost.includes("localhost") || cleanHost.includes("127.0.0.1")
          ? "http"
          : "https";

      if (isProd && (cleanHost.includes("localhost") || cleanHost.includes("127.0.0.1"))) {
        return PRODUCTION_DOMAIN;
      }

      if (cleanHost) {
        return `${proto}://${cleanHost}`;
      }
    }
  }

  // 3. Fallback to synchronous resolution
  return getAppUrlSync(fallbackOrigin);
}

/**
 * Sanitize any email action URL to prevent localhost leakage in production.
 */
export function sanitizeEmailUrl(url?: string): string {
  if (!url) return getAppUrlSync();
  const trimmed = url.trim();

  // Relative path: prepend canonical base URL
  if (trimmed.startsWith("/")) {
    return `${getAppUrlSync()}${trimmed}`;
  }

  // Replace any localhost:3000 in production
  if (isProductionEnvironment() && (trimmed.includes("localhost:3000") || trimmed.includes("127.0.0.1:3000"))) {
    return trimmed
      .replace(/https?:\/\/localhost:3000/g, PRODUCTION_DOMAIN)
      .replace(/https?:\/\/127\.0\.0\.1:3000/g, PRODUCTION_DOMAIN);
  }

  return trimmed;
}
