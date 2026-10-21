const fs = require('fs');
const path = require('path');

console.log('[patch-worker] Ensuring .open-next/worker.js has RSC loop prevention...');

const workerFile = path.join(__dirname, '..', '.open-next', 'worker.js');
if (fs.existsSync(workerFile)) {
  let content = fs.readFileSync(workerFile, 'utf8');
  if (!content.includes('cleanRscUrl')) {
    const hookMarker = `export default {`;
    const helperCode = `
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
`;
    content = content.replace(hookMarker, `${helperCode}\n${hookMarker}`);

    // Clean incoming request
    const incomingMarker = `const url = new URL(request.url);`;
    const incomingReplacement = `let url = new URL(request.url);
            const cleanedIncoming = cleanRscUrl(request.url);
            if (cleanedIncoming) {
                url = cleanedIncoming;
                request = new Request(cleanedIncoming.toString(), request);
            }`;
    content = content.replace(incomingMarker, incomingReplacement);

    // Intercept handler call and response
    const handlerMarker = `const { handler } = await import("./server-functions/default/handler.mjs");
            return handler(reqOrResp, env, ctx, request.signal);`;
    const handlerReplacement = `const { handler } = await import("./server-functions/default/handler.mjs");
            const finalResp = await handler(reqOrResp, env, ctx, request.signal);

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
                            return new Response(finalResp.body, {
                                status: finalResp.status,
                                statusText: finalResp.statusText,
                                headers: newHeaders,
                            });
                        } else if (cleanedLocation) {
                            const newHeaders = new Headers(finalResp.headers);
                            newHeaders.set("Location", cleanedLocation.pathname + cleanedLocation.search);
                            return new Response(finalResp.body, {
                                status: finalResp.status,
                                statusText: finalResp.statusText,
                                headers: newHeaders,
                            });
                        }
                    } catch {}
                }
            }

            return finalResp;`;
    content = content.replace(handlerMarker, handlerReplacement);
    fs.writeFileSync(workerFile, content, 'utf8');
    console.log('[patch-worker] Successfully patched .open-next/worker.js');
  } else {
    console.log('[patch-worker] .open-next/worker.js is already patched.');
  }
} else {
  console.warn('[patch-worker] .open-next/worker.js not found, skipping.');
}
