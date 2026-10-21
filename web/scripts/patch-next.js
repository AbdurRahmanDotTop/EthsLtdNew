const fs = require('fs');
const path = require('path');

console.log('[patch-next] Applying Next.js & OpenNext RSC loop prevention patch...');

// 1. Patch set-cache-busting-search-param.js (CJS)
const cjsFile = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'client', 'components', 'router-reducer', 'set-cache-busting-search-param.js');
if (fs.existsSync(cjsFile)) {
  let content = fs.readFileSync(cjsFile, 'utf8');
  const target = `filter((pair)=>pair && !pair.startsWith(\`\${_approuterheaders.NEXT_RSC_UNION_QUERY}=\`));`;
  const replacement = `filter((pair)=>pair && !pair.startsWith(\`\${_approuterheaders.NEXT_RSC_UNION_QUERY}=\`) && pair !== _approuterheaders.NEXT_RSC_UNION_QUERY);`;
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(cjsFile, content, 'utf8');
    console.log('[patch-next] Patched Next.js CJS set-cache-busting-search-param.js');
  }
}

// 2. Patch set-cache-busting-search-param.js (ESM)
const esmFile = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'esm', 'client', 'components', 'router-reducer', 'set-cache-busting-search-param.js');
if (fs.existsSync(esmFile)) {
  let content = fs.readFileSync(esmFile, 'utf8');
  const target = `filter((pair)=>pair && !pair.startsWith(\`\${NEXT_RSC_UNION_QUERY}=\`));`;
  const replacement = `filter((pair)=>pair && !pair.startsWith(\`\${NEXT_RSC_UNION_QUERY}=\`) && pair !== NEXT_RSC_UNION_QUERY);`;
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(esmFile, content, 'utf8');
    console.log('[patch-next] Patched Next.js ESM set-cache-busting-search-param.js');
  }
}

// 3. Patch compiled next-server runtime
const runtimeFile = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'compiled', 'next-server', 'app-page.runtime.prod.js');
if (fs.existsSync(runtimeFile)) {
  let content = fs.readFileSync(runtimeFile, 'utf8');
  let changed = false;

  const target1 = `pair=>pair&&!pair.startsWith(\`\${_approuterheaders.NEXT_RSC_UNION_QUERY}=\`)`;
  const repl1 = `pair=>pair&&!pair.startsWith(\`\${_approuterheaders.NEXT_RSC_UNION_QUERY}=\`)&&pair!==_approuterheaders.NEXT_RSC_UNION_QUERY`;
  if (content.includes(target1) && !content.includes(repl1)) {
    content = content.replaceAll(target1, repl1);
    changed = true;
  }

  const target2 = `a3=>a3&&!a3.startsWith(\`\${g.NEXT_RSC_UNION_QUERY}=\`)`;
  const repl2 = `a3=>a3&&!a3.startsWith(\`\${g.NEXT_RSC_UNION_QUERY}=\`)&&a3!==g.NEXT_RSC_UNION_QUERY`;
  if (content.includes(target2) && !content.includes(repl2)) {
    content = content.replaceAll(target2, repl2);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(runtimeFile, content, 'utf8');
    console.log('[patch-next] Patched Next.js compiled app-page.runtime.prod.js');
  }
}

// 4. Patch OpenNext Cloudflare template
const templateFile = path.join(__dirname, '..', 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'templates', 'worker.js');
if (fs.existsSync(templateFile)) {
  let content = fs.readFileSync(templateFile, 'utf8');
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
    fs.writeFileSync(templateFile, content, 'utf8');
    console.log('[patch-next] Patched OpenNext Cloudflare worker.js template');
  }
}

console.log('[patch-next] Patch application completed successfully.');
