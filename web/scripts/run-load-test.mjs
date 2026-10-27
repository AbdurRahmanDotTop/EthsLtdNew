/**
 * ETHSLTD Production & Edge Load-Testing Suite
 * Uses Autocannon to simulate concurrent user traffic and detect Error 1102 / 503
 */

import autocannon from "autocannon";

const BASE_URL = process.env.TARGET_URL || "https://ethsltd.com";

const SCENARIOS = [
  {
    name: "API Markets Tickers (High-Frequency Edge Polling)",
    path: "/api/markets/tickers",
    stages: [
      { connections: 10, duration: 10, title: "10 Users Concurrency" },
      { connections: 30, duration: 10, title: "30 Users Concurrency" },
      { connections: 60, duration: 10, title: "60 Users Concurrency" },
    ],
  },
  {
    name: "Homepage SSR & Edge Dynamic Render",
    path: "/",
    stages: [
      { connections: 10, duration: 10, title: "10 Users Concurrency" },
      { connections: 25, duration: 10, title: "25 Users Concurrency" },
      { connections: 50, duration: 10, title: "50 Users Concurrency" },
    ],
  },
  {
    name: "P2P Marketplace SSR & Ad Directory",
    path: "/p2p",
    stages: [
      { connections: 10, duration: 10, title: "10 Users Concurrency" },
      { connections: 25, duration: 10, title: "25 Users Concurrency" },
      { connections: 50, duration: 10, title: "50 Users Concurrency" },
    ],
  },
  {
    name: "Login Authentication Page SSR",
    path: "/login",
    stages: [
      { connections: 10, duration: 10, title: "10 Users Concurrency" },
      { connections: 25, duration: 10, title: "25 Users Concurrency" },
      { connections: 50, duration: 10, title: "50 Users Concurrency" },
    ],
  },
  {
    name: "Registration & Turnstile Page SSR",
    path: "/register",
    stages: [
      { connections: 10, duration: 10, title: "10 Users Concurrency" },
      { connections: 25, duration: 10, title: "25 Users Concurrency" },
      { connections: 50, duration: 10, title: "50 Users Concurrency" },
    ],
  },
];

async function runSingleTest(endpointName, url, opts) {
  console.log(`\n==========================================================`);
  console.log(`🚀 RUNNING: ${endpointName} -> ${opts.title}`);
  console.log(`   URL: ${url}`);
  console.log(`   Connections: ${opts.connections} | Duration: ${opts.duration}s`);
  console.log(`==========================================================`);

  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url,
        connections: opts.connections,
        duration: opts.duration,
        pipelining: 1,
        headers: {
          "user-agent": "ETHSLTD-LoadTest/1.0",
          accept: "text/html,application/json,*/*",
        },
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    autocannon.track(instance, { renderProgressBar: true });
  });
}

function parseAndLogResults(result) {
  const { requests, latency, throughput, errors, timeouts, non2xx, statusCodeStats } = result;

  console.log(`\n📊 RESULTS SUMMARY:`);
  console.log(`   - Total Requests:      ${requests.total}`);
  console.log(`   - Requests/Sec (RPS):  ${requests.average} (Max: ${requests.max})`);
  console.log(`   - Avg Latency:         ${latency.average.toFixed(2)} ms`);
  console.log(`   - Latency (p50):       ${latency.p50} ms`);
  console.log(`   - Latency (p90):       ${latency.p90} ms`);
  console.log(`   - Latency (p99):       ${latency.p99} ms`);
  console.log(`   - Max Latency:         ${latency.max} ms`);
  console.log(`   - Throughput (MB/s):   ${((throughput.average || 0) / (1024 * 1024)).toFixed(2)} MB/s`);
  console.log(`   - Errors (Socket):     ${errors}`);
  console.log(`   - Timeouts:            ${timeouts}`);
  console.log(`   - Non-2xx Responses:   ${non2xx}`);

  if (statusCodeStats) {
    console.log(`   - Status Codes Breakdown:`);
    for (const [code, stat] of Object.entries(statusCodeStats)) {
      console.log(`       HTTP ${code}: ${stat.count} responses`);
    }
  }

  // Check specifically for Error 1102 / 503
  const is503Present = statusCodeStats && statusCodeStats["503"] && statusCodeStats["503"].count > 0;
  if (is503Present) {
    console.error(`🚨 ALERT: HTTP 503 (Potential Error 1102 / Worker limit) detected! Count: ${statusCodeStats["503"].count}`);
  } else {
    console.log(`   ✅ Zero 503 / Error 1102 errors detected.`);
  }

  return {
    totalRequests: requests.total,
    rps: requests.average,
    avgLatency: latency.average,
    p50: latency.p50,
    p90: latency.p90,
    p99: latency.p99,
    maxLatency: latency.max,
    errors,
    timeouts,
    non2xx,
    status503: is503Present ? statusCodeStats["503"].count : 0,
  };
}

async function main() {
  console.log(`****************************************************************`);
  console.log(`  ETHSLTD HIGH-VOLUME CONCURRENCY LOAD BENCHMARK  `);
  console.log(`  Target Base: ${BASE_URL}`);
  console.log(`  Start Time: ${new Date().toISOString()}`);
  console.log(`****************************************************************\n`);

  const fullReport = [];

  for (const scenario of SCENARIOS) {
    const scenarioResults = {
      name: scenario.name,
      path: scenario.path,
      stages: [],
    };

    for (const stage of scenario.stages) {
      try {
        const result = await runSingleTest(scenario.name, `${BASE_URL}${scenario.path}`, stage);
        const parsed = parseAndLogResults(result);
        scenarioResults.stages.push({
          title: stage.title,
          connections: stage.connections,
          duration: stage.duration,
          ...parsed,
        });

        // 2-second cooldown between stages to allow edge isolates to settle
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`❌ Stage failed: ${err.message}`);
      }
    }

    fullReport.push(scenarioResults);
  }

  console.log(`\n\n==========================================================`);
  console.log(`🎉 ALL BENCHMARK SCENARIOS COMPLETED`);
  console.log(`==========================================================`);
  console.log(JSON.stringify(fullReport, null, 2));
}

main().catch(console.error);
