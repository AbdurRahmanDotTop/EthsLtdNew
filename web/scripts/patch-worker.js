const fs = require('fs');
const path = require('path');

console.log('[patch-worker] Ensuring .open-next/worker.js has static handler import and high-concurrency resilience...');

const workerFile = path.join(__dirname, '..', '.open-next', 'worker.js');
if (fs.existsSync(workerFile)) {
  let content = fs.readFileSync(workerFile, 'utf8');

  // 1. Ensure static handler import
  if (!content.includes('import { handler } from "./server-functions/default/handler.mjs";')) {
    const mwImport = 'import { handler as middlewareHandler } from "./middleware/handler.mjs";';
    const bothImports = `${mwImport}\n// @ts-expect-error: Will be resolved by wrangler build\nimport { handler } from "./server-functions/default/handler.mjs";`;
    content = content.replace(mwImport, bothImports);
  }

  // 2. Ensure cleanRscUrl helper
  if (!content.includes('function cleanRscUrl(')) {
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
  }

  // 3. Ensure resilient execution block
  if (content.includes('const { handler } = await import("./server-functions/default/handler.mjs");')) {
    const oldBlock = `const reqOrResp = await middlewareHandler(request, env, ctx);
            if (reqOrResp instanceof Response) {
                return reqOrResp;
            }
            // @ts-expect-error: resolved by wrangler build
            const { handler } = await import("./server-functions/default/handler.mjs");
            return handler(reqOrResp, env, ctx, request.signal);`;

    const newBlock = `let reqOrResp;
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

            let finalResp;
            try {
                finalResp = await handler(reqOrResp || request, env, ctx, request.signal);
            } catch {
                try {
                    finalResp = await handler(request, env, ctx, request.signal);
                } catch {
                    return new Response("Service Temporarily Unavailable", { status: 503 });
                }
            }`;
    content = content.replace(oldBlock, newBlock);
  }

  fs.writeFileSync(workerFile, content, 'utf8');
  console.log('[patch-worker] Successfully updated .open-next/worker.js');
} else {
  console.warn('[patch-worker] .open-next/worker.js not found, skipping.');
}
