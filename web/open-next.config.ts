import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // @ts-expect-error - TS2353: known properties mismatch
  imageOptimization: false,
});
