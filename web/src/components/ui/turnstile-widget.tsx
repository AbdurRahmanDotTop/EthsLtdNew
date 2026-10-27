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
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  const siteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || CLOUDFLARE_PRODUCTION_SITEKEY;

  useEffect(() => {
    if (!isScriptLoaded || !containerRef.current || !window.turnstile) {
      return;
    }

    // Clean up any existing widget before re-rendering
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
    }

    try {
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "dark",
        size: "normal",
        callback: (token: string) => {
          onVerify(token);
        },
        "error-callback": (err: any) => {
          console.warn("Turnstile challenge error:", err);
          if (onError) onError("Bot check error. Please reload.");
        },
        "expired-callback": () => {
          if (onExpire) onExpire();
        },
      });
      widgetIdRef.current = id;
    } catch (err) {
      console.warn("Error rendering Turnstile widget:", err);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
      }
    };
  }, [isScriptLoaded, siteKey, onVerify, onError, onExpire]);


  return (
    <div className={`turnstile-container flex flex-col items-center justify-center my-3 min-h-[65px] ${className}`}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setIsScriptLoaded(true)}
      />
      <div ref={containerRef} id="cf-turnstile-widget" />
    </div>
  );
}
