const fs = require('fs');
const path = require('path');

console.log('[patch-worker] Applying ultra-resilient Cloudflare Worker entrypoint with Edge Cache & CPU protections...');

const workerFile = path.join(__dirname, '..', '.open-next', 'worker.js');
if (fs.existsSync(workerFile)) {
  const enhancedWorkerContent = `//@ts-expect-error: Will be resolved by wrangler build
import { handleCdnCgiImageRequest, handleImageRequest } from "./cloudflare/images.js";
//@ts-expect-error: Will be resolved by wrangler build
import { runWithCloudflareRequestContext } from "./cloudflare/init.js";
//@ts-expect-error: Will be resolved by wrangler build
import { maybeGetSkewProtectionResponse } from "./cloudflare/skew-protection.js";
// @ts-expect-error: Will be resolved by wrangler build
import { handler as middlewareHandler } from "./middleware/handler.mjs";
// @ts-expect-error: Will be resolved by wrangler build
import { handler } from "./server-functions/default/handler.mjs";
//@ts-expect-error: Will be resolved by wrangler build
export { DOQueueHandler } from "./.build/durable-objects/queue.js";
//@ts-expect-error: Will be resolved by wrangler build
export { DOShardedTagCache } from "./.build/durable-objects/sharded-tag-cache.js";
//@ts-expect-error: Will be resolved by wrangler build
export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";

function cleanRscUrl(rawUrl) {
    try {
        const u = new URL(rawUrl);
        if (u.search.includes("_rsc")) {
            const rscList = u.searchParams.getAll("_rsc");
            if (rscList.length > 1 || (rscList.length === 1 && rscList[0] === "")) {
                const validHash = rscList.filter(Boolean).pop();
                u.searchParams.delete("_rsc");
                if (validHash) {
                    u.searchParams.set("_rsc", validHash);
                }
                return u;
            }
        }
    } catch {}
    return null;
}

function getCacheRules(request, url) {
    if (request.method !== "GET" && request.method !== "HEAD") return null;

    const cookie = request.headers.get("cookie") || "";
    // Security & Data Accuracy: Never edge-cache authenticated requests or private user data
    if (cookie.includes("ethsltd_auth_token") || Boolean(request.headers.get("authorization"))) {
        return null;
    }

    const p = url.pathname;
    // Strictly forbid edge caching of user dashboards, admin, wallets, trades, P2P transactions
    if (
        p.startsWith("/assets") ||
        p.startsWith("/profile") ||
        p.startsWith("/security") ||
        p.startsWith("/admin") ||
        p.startsWith("/contracts") ||
        p.startsWith("/rm/chat") ||
        p.startsWith("/rm/dashboard") ||
        p.startsWith("/api/v1/wallets") ||
        p.startsWith("/api/v1/trading") ||
        p.startsWith("/api/v1/p2p") ||
        p.startsWith("/api/v1/auth") ||
        p.startsWith("/api/v1/2fa")
    ) {
        return null;
    }

    // High-frequency public polling endpoint: 5s edge cache completely protects against Error 1102
    if (p === "/api/markets/tickers") {
        return { ttl: 5, swr: 15 };
    }

    // Public currency rates
    if (p === "/api/v1/currency-rates") {
        return { ttl: 30, swr: 120 };
    }

    // Public static RSC prefetch requests for unauthenticated visitors
    if (url.search.includes("_rsc")) {
        return { ttl: 15, swr: 60 };
    }

    // Public landing pages for unauthenticated visitors (instant CDN delivery)
    if (p === "/" || p === "/trade" || p === "/options" || p === "/p2p" || p === "/relationship-managers" || p === "/trust" || p === "/login" || p === "/register") {
        return { ttl: 10, swr: 30 };
    }

    return null;
}

export default {
    async fetch(request, env, ctx) {
        return runWithCloudflareRequestContext(request, env, ctx, async () => {
            const response = maybeGetSkewProtectionResponse(request);
            if (response) {
                return response;
            }
            let url = new URL(request.url);
            const cleanedIncoming = cleanRscUrl(request.url);
            if (cleanedIncoming) {
                url = cleanedIncoming;
                request = new Request(cleanedIncoming.toString(), request);
            }

            // Serve images in development
            if (url.pathname.startsWith("/cdn-cgi/image/")) {
                return handleCdnCgiImageRequest(url, env);
            }
            if (url.pathname === \`\${globalThis.__NEXT_BASE_PATH__}/_next/image\${globalThis.__TRAILING_SLASH__ ? "/" : ""}\`) {
                return await handleImageRequest(url, request.headers, env);
            }

            // 1. Cloudflare Edge Cache API: Instant edge response without Worker CPU execution
            const cacheRules = getCacheRules(request, url);
            let cache = null;
            let cacheKey = null;

            if (cacheRules && typeof caches !== "undefined" && caches.default) {
                try {
                    cache = caches.default;
                    cacheKey = new Request(url.toString(), {
                        method: "GET",
                        headers: {
                            accept: request.headers.get("accept") || "*/*",
                            rsc: request.headers.get("rsc") || "",
                            "next-router-prefetch": request.headers.get("next-router-prefetch") || "",
                            "next-router-state-tree": request.headers.get("next-router-state-tree") || "",
                        }
                    });
                    const cachedMatch = await cache.match(cacheKey);
                    if (cachedMatch) {
                        const hitHeaders = new Headers(cachedMatch.headers);
                        hitHeaders.set("CF-Cache-Status", "HIT");
                        hitHeaders.set("X-Edge-Cache", "HIT");
                        return new Response(cachedMatch.body, {
                            status: cachedMatch.status,
                            statusText: cachedMatch.statusText,
                            headers: hitHeaders,
                        });
                    }
                } catch {
                    // Non-blocking fallback to dynamic execution
                }
            }

            // 2. Next.js Middleware execution
            let reqOrResp;
            try {
                reqOrResp = await middlewareHandler(request, env, ctx);
                if (reqOrResp instanceof Response) {
                    return reqOrResp;
                }
                if (reqOrResp && reqOrResp.internalEvent && reqOrResp.internalEvent.rawPath === "/500" && url.pathname !== "/500") {
                    reqOrResp = request;
                }
            } catch {
                reqOrResp = request;
            }

            // 3. Next.js Server Handler execution (Static Import - Zero Dynamic Require Overhead)
            let finalResp;
            try {
                finalResp = await handler(reqOrResp || request, env, ctx, request.signal);
            } catch {
                try {
                    finalResp = await handler(request, env, ctx, request.signal);
                } catch (fallbackErr) {
                    console.error("Worker Execution Fallback:", fallbackErr);
                    return new Response("Service Temporarily Unavailable", { status: 503 });
                }
            }

            // 4. Handle RSC Redirect sanitization
            if (finalResp && finalResp.status >= 300 && finalResp.status < 400) {
                const location = finalResp.headers.get("Location");
                if (location) {
                    try {
                        const targetUrl = new URL(location, url.origin);
                        const cleanedLocation = cleanRscUrl(targetUrl.href);
                        const effectiveUrl = cleanedLocation || targetUrl;

                        if (effectiveUrl.pathname === url.pathname && effectiveUrl.search === url.search) {
                            effectiveUrl.searchParams.delete("_rsc");
                            const newHeaders = new Headers(finalResp.headers);
                            newHeaders.set("Location", effectiveUrl.pathname + effectiveUrl.search);
                            finalResp = new Response(finalResp.body, {
                                status: finalResp.status,
                                statusText: finalResp.statusText,
                                headers: newHeaders,
                            });
                        } else if (cleanedLocation) {
                            const newHeaders = new Headers(finalResp.headers);
                            newHeaders.set("Location", cleanedLocation.pathname + cleanedLocation.search);
                            finalResp = new Response(finalResp.body, {
                                status: finalResp.status,
                                statusText: finalResp.statusText,
                                headers: newHeaders,
                            });
                        }
                    } catch {}
                }
            }

            // 5. Cloudflare Edge Cache API: Store Response in Cloudflare Global Edge Cache
            if (cache && cacheKey && cacheRules && finalResp && finalResp.status === 200 && !finalResp.headers.get("set-cookie")) {
                try {
                    const cacheHeaders = new Headers(finalResp.headers);
                    cacheHeaders.set(
                        "Cache-Control",
                        \`public, max-age=\${cacheRules.ttl}, s-maxage=\${cacheRules.ttl}, stale-while-revalidate=\${cacheRules.swr}\`
                    );
                    cacheHeaders.set("CF-Cache-Status", "MISS");
                    cacheHeaders.set("X-Edge-Cache", "MISS");

                    const toCache = new Response(finalResp.clone().body, {
                        status: finalResp.status,
                        statusText: finalResp.statusText,
                        headers: cacheHeaders,
                    });

                    if (ctx && typeof ctx.waitUntil === "function") {
                        ctx.waitUntil(cache.put(cacheKey, toCache));
                    } else {
                        await cache.put(cacheKey, toCache);
                    }
                } catch {
                    // Non-blocking cache store
                }
            }

            return finalResp;
        });
    },
};
`;

  fs.writeFileSync(workerFile, enhancedWorkerContent, 'utf8');
  console.log('[patch-worker] Successfully wrote enhanced .open-next/worker.js');
} else {
  console.warn('[patch-worker] .open-next/worker.js not found, skipping.');
}
