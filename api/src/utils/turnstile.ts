/**
 * Cloudflare Turnstile Server-Side Token Verification
 * ETHSLTD Security Suite (Worker / API)
 */

const TURNSTILE_VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const CLOUDFLARE_PRODUCTION_SECRET = "0x4AAAAAAFn4uXDwpUDV7pZJSdbAQ9Wf3XY";

export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
  challengeTs?: string;
  hostname?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
  configuredSecret?: string
): Promise<TurnstileVerificationResult> {
  const secretKey = configuredSecret || CLOUDFLARE_PRODUCTION_SECRET;

  if (!token || typeof token !== "string" || token.trim() === "") {
    return {
      success: false,
      error: "Bot protection verification required. Missing Turnstile token.",
    };
  }

  const cleanToken = token.trim();

  // Test token bypass strictly restricted to automated CLI test runs
  const isCliTestMode =
    typeof process !== "undefined" &&
    process.env &&
    process.env.CLI_TEST_MODE === "true";

  if (
    isCliTestMode &&
    (cleanToken === "DUMMY_TOKEN_DEV" ||
      cleanToken === "XXXX.DUMMY.TOKEN.XXXX" ||
      cleanToken.startsWith("CF_TEST_") ||
      cleanToken === "test_turnstile_token_passed")
  ) {
    return {
      success: true,
      challengeTs: new Date().toISOString(),
      hostname: "localhost",
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", cleanToken);
    if (remoteIp && remoteIp !== "127.0.0.1" && remoteIp !== "::1") {
      formData.append("remoteip", remoteIp);
    }

    const res = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok) {
      console.error(`Turnstile HTTP error: ${res.status} ${res.statusText}`);
      return {
        success: false,
        error: "Turnstile verification service unreachable.",
      };
    }

    const outcome = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
    };

    if (outcome.success) {
      return {
        success: true,
        challengeTs: outcome.challenge_ts,
        hostname: outcome.hostname,
      };
    }

    console.warn("Turnstile verification failed. Error codes:", outcome["error-codes"]);
    return {
      success: false,
      error: "Bot verification failed. Turnstile token is invalid or expired.",
    };
  } catch (err: unknown) {
    console.error("Turnstile verification error:", err);
    return {
      success: false,
      error: "Turnstile verification failed with an unexpected error.",
    };
  }
}
