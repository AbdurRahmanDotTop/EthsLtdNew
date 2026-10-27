/**
 * Cloudflare Turnstile Server-Side Token Verification
 * ETHSLTD Security Suite
 */

const TURNSTILE_VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Production Cloudflare Turnstile secret key for ethsltd.com
const CLOUDFLARE_PRODUCTION_SECRET = "0x4AAAAAAFn4uXDwpUDV7pZJSdbAQ9Wf3XY";

export interface TurnstileVerificationResult {
  success: boolean;
  error?: string;
  challengeTs?: string;
  hostname?: string;
}

/**
 * Validates a Cloudflare Turnstile response token with Cloudflare's siteverify API.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY || CLOUDFLARE_PRODUCTION_SECRET;

  if (!token || typeof token !== "string" || token.trim() === "") {
    return {
      success: false,
      error: "Bot protection verification required. Please complete the security check.",
    };
  }

  const cleanToken = token.trim();

  // Support automated CLI testing test-suites (process.env.CLI_TEST_MODE)
  if (
    process.env.CLI_TEST_MODE === "true" &&
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
        error: "Security verification server temporarily unreachable. Please retry.",
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
      error: "Automated bot verification failed. Please refresh the page and complete the captcha check.",
    };
  } catch (err: unknown) {
    console.error("Turnstile verification exception:", err);
    return {
      success: false,
      error: "Security verification service encountered an issue. Please retry.",
    };
  }
}
