"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: (error: any) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onTurnstileLoaded?: () => void;
  }
}

// Official Cloudflare Production Turnstile site key for ethsltd.com
const CLOUDFLARE_PRODUCTION_SITEKEY = "0x4AAAAAAFn4uW-glCk6yige";

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  className = "",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const isRenderingRef = useRef(false);
  const [hasError, setHasError] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(() => {
    return typeof window !== "undefined" && !!window.turnstile;
  });

  // Keep latest callback references without re-triggering effect
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  });

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || CLOUDFLARE_PRODUCTION_SITEKEY;

  // Check if turnstile global became available
  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile && !isScriptLoaded) {
      setIsScriptLoaded(true);
    }
  }, [isScriptLoaded]);

  // Render widget once script and container are ready
  useEffect(() => {
    if (!isScriptLoaded || !containerRef.current || !window.turnstile) {
      return;
    }

    // Never re-render if already rendered or actively rendering
    if (widgetIdRef.current || isRenderingRef.current) {
      return;
    }

    isRenderingRef.current = true;
    try {
      // Clear container before initial render
      containerRef.current.innerHTML = "";

      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
        size: "normal",
        callback: (token: string) => {
          setHasError(false);
          onVerifyRef.current?.(token);
        },
        "error-callback": (err: any) => {
          console.warn("Turnstile challenge error:", err);
          setHasError(true);
          onErrorRef.current?.("Bot check error. Please retry.");
        },
        "expired-callback": () => {
          onExpireRef.current?.();
        },
      });
      widgetIdRef.current = id;
    } catch (err) {
      console.warn("Error rendering Turnstile widget:", err);
    } finally {
      isRenderingRef.current = false;
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [isScriptLoaded, siteKey]);

  const handleRetry = () => {
    setHasError(false);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Fallback: re-render
        if (containerRef.current && window.turnstile) {
          try {
            containerRef.current.innerHTML = "";
            const id = window.turnstile.render(containerRef.current, {
              sitekey: siteKey,
              theme: "dark",
              size: "normal",
              callback: (token: string) => {
                setHasError(false);
                onVerifyRef.current?.(token);
              },
              "error-callback": () => setHasError(true),
              "expired-callback": () => onExpireRef.current?.(),
            });
            widgetIdRef.current = id;
          } catch {}
        }
      }
    }
  };

  return (
    <div className={`turnstile-container flex flex-col items-center justify-center my-3 min-h-[65px] ${className}`}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setIsScriptLoaded(true)}
      />
      <div ref={containerRef} id="cf-turnstile-widget" />
      {hasError && (
        <button
          type="button"
          onClick={handleRetry}
          className="mt-2 text-xs text-[#00A070] hover:text-emerald-400 underline transition-colors cursor-pointer"
        >
          Verification issue? Click here to retry
        </button>
      )}
    </div>
  );
}
