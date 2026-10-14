"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { TrackingConfigData } from "@/lib/tracking";

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    dataLayer?: any[];
  }
}

interface TrackingScriptsProps {
  config: TrackingConfigData;
}

export function TrackingScripts({ config }: TrackingScriptsProps) {
  const pathname = usePathname();
  const initialLoadRef = useRef(true);

  const isAdmin = pathname?.startsWith("/admin");
  const shouldTrack = !isAdmin || config.trackAdminPages;

  // SPA Route Change Listener: Fire PageView on Next.js client-side navigations
  useEffect(() => {
    if (!shouldTrack || typeof window === "undefined") return;

    // Skip the very first run because the inline snippet already fired on initialization
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }

    // Meta Pixel route tracking
    if (config.metaPixelEnabled && config.metaPixelId && typeof window.fbq === "function") {
      try {
        window.fbq("track", "PageView");
      } catch (err) {
        console.debug("Meta Pixel track error:", err);
      }
    }

    // Google Tag Manager Virtual Pageview event
    if (config.gtmEnabled && config.gtmId && Array.isArray(window.dataLayer)) {
      try {
        window.dataLayer.push({
          event: "virtualPageview",
          page_path: pathname,
          page_location: window.location.href,
          page_title: document.title,
        });
      } catch (err) {
        console.debug("GTM push error:", err);
      }
    }
  }, [pathname, shouldTrack, config.metaPixelEnabled, config.metaPixelId, config.gtmEnabled, config.gtmId]);

  if (!shouldTrack) {
    return null;
  }

  const cleanPixelId = config.metaPixelId?.trim();
  const cleanGtmId = config.gtmId?.trim();

  return (
    <>
      {/* ---------------- META PIXEL INJECTION ---------------- */}
      {config.metaPixelEnabled && cleanPixelId && (
        config.metaCustomScript ? (
          <Script
            id="meta-pixel-custom"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: config.metaCustomScript }}
          />
        ) : (
          <Script
            id="meta-pixel-base"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${cleanPixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
        )
      )}

      {/* ---------------- GOOGLE TAG MANAGER INJECTION ---------------- */}
      {config.gtmEnabled && cleanGtmId && (
        config.gtmCustomScript ? (
          <Script
            id="gtm-custom"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: config.gtmCustomScript }}
          />
        ) : (
          <Script
            id="google-tag-manager"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${cleanGtmId}');
              `,
            }}
          />
        )
      )}

      {/* ---------------- CUSTOM HEAD CODE OVERRIDE ---------------- */}
      {config.customHeadCode && (
        <Script
          id="custom-head-tracking"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: config.customHeadCode }}
        />
      )}
    </>
  );
}

/**
 * Server-renderable noscript tags for non-JS clients and SEO crawlers
 */
export function TrackingNoScript({ config }: { config: TrackingConfigData }) {
  const cleanPixelId = config.metaPixelId?.trim();
  const cleanGtmId = config.gtmId?.trim();

  return (
    <>
      {/* GTM Noscript */}
      {config.gtmEnabled && cleanGtmId && (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${cleanGtmId}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
      )}

      {/* Meta Pixel Noscript */}
      {config.metaPixelEnabled && cleanPixelId && (
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${cleanPixelId}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      )}

      {/* Custom Body Code snippet if any */}
      {config.customBodyCode && (
        <div
          id="custom-body-tracking-container"
          style={{ display: "none" }}
          dangerouslySetInnerHTML={{ __html: config.customBodyCode }}
        />
      )}
    </>
  );
}
