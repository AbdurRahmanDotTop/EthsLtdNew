"use client";

import { useEffect, useState } from "react";
import {
  getTrackingConfigAdmin,
  saveTrackingConfig,
  resetTrackingConfig,
} from "@/actions/tracking";
import {
  DEFAULT_TRACKING_CONFIG,
  TrackingConfigData,
} from "@/lib/tracking";
import {
  Activity,
  Tag,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  RotateCcw,
  ExternalLink,
  Code2,
  Sparkles,
  Save,
  AlertTriangle,
  Radio,
  Sliders,
  Shield,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminTrackingPage() {
  const [config, setConfig] = useState<TrackingConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Form State
  const [metaPixelEnabled, setMetaPixelEnabled] = useState(true);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaCustomScript, setMetaCustomScript] = useState("");
  const [showMetaAdvanced, setShowMetaAdvanced] = useState(false);

  const [gtmEnabled, setGtmEnabled] = useState(true);
  const [gtmId, setGtmId] = useState("");
  const [gtmCustomScript, setGtmCustomScript] = useState("");
  const [showGtmAdvanced, setShowGtmAdvanced] = useState(false);

  const [customHeadCode, setCustomHeadCode] = useState("");
  const [customBodyCode, setCustomBodyCode] = useState("");
  const [showGlobalAdvanced, setShowGlobalAdvanced] = useState(false);

  const [trackAdminPages, setTrackAdminPages] = useState(false);

  // Live Test State
  const [testResult, setTestResult] = useState<{
    fbqAvailable: boolean;
    gtmAvailable: boolean;
    message: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getTrackingConfigAdmin();
      setConfig(data);
      setMetaPixelEnabled(data.metaPixelEnabled);
      setMetaPixelId(data.metaPixelId || "");
      setMetaCustomScript(data.metaCustomScript || "");
      setShowMetaAdvanced(Boolean(data.metaCustomScript));

      setGtmEnabled(data.gtmEnabled);
      setGtmId(data.gtmId || "");
      setGtmCustomScript(data.gtmCustomScript || "");
      setShowGtmAdvanced(Boolean(data.gtmCustomScript));

      setCustomHeadCode(data.customHeadCode || "");
      setCustomBodyCode(data.customBodyCode || "");
      setShowGlobalAdvanced(Boolean(data.customHeadCode || data.customBodyCode));

      setTrackAdminPages(data.trackAdminPages);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to load tracking configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      const res = await saveTrackingConfig({
        metaPixelEnabled,
        metaPixelId: metaPixelId.trim() || null,
        metaCustomScript: metaCustomScript.trim() || null,
        gtmEnabled,
        gtmId: gtmId.trim() || null,
        gtmCustomScript: gtmCustomScript.trim() || null,
        customHeadCode: customHeadCode.trim() || null,
        customBodyCode: customBodyCode.trim() || null,
        trackAdminPages,
      });

      if (res.success && res.config) {
        setConfig(res.config);
        toast.success("Tracking & Pixel settings saved successfully!");
      } else {
        toast.error(res.error || "Failed to save settings.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        `Are you sure you want to reset all tracking parameters to the original default codes?\n\n• Meta Pixel ID: ${DEFAULT_TRACKING_CONFIG.metaPixelId}\n• GTM ID: ${DEFAULT_TRACKING_CONFIG.gtmId}`
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      const res = await resetTrackingConfig();
      if (res.success && res.config) {
        setConfig(res.config);
        setMetaPixelEnabled(res.config.metaPixelEnabled);
        setMetaPixelId(res.config.metaPixelId || "");
        setMetaCustomScript("");
        setShowMetaAdvanced(false);

        setGtmEnabled(res.config.gtmEnabled);
        setGtmId(res.config.gtmId || "");
        setGtmCustomScript("");
        setShowGtmAdvanced(false);

        setCustomHeadCode("");
        setCustomBodyCode("");
        setShowGlobalAdvanced(false);

        setTrackAdminPages(res.config.trackAdminPages);
        toast.success("Tracking settings reset to default!");
      } else {
        toast.error(res.error || "Failed to reset settings.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to reset tracking configuration.");
    } finally {
      setResetting(false);
    }
  };

  // Live in-browser tag diagnostic test
  const handleRunDiagnostic = () => {
    if (typeof window === "undefined") return;

    const fbqExists = typeof (window as any).fbq === "function";
    const dataLayerExists = Array.isArray((window as any).dataLayer);

    if (fbqExists) {
      try {
        (window as any).fbq("trackCustom", "AdminTagVerification", {
          timestamp: new Date().toISOString(),
          status: "verified",
        });
      } catch (err) {
        console.warn("Test fbq failed:", err);
      }
    }

    if (dataLayerExists) {
      try {
        (window as any).dataLayer.push({
          event: "admin_tag_verification",
          timestamp: Date.now(),
        });
      } catch (err) {
        console.warn("Test dataLayer failed:", err);
      }
    }

    setTestResult({
      fbqAvailable: fbqExists,
      gtmAvailable: dataLayerExists,
      message: `Diagnostic complete at ${new Date().toLocaleTimeString()}. Window tags scanned.`,
    });

    if (fbqExists || dataLayerExists) {
      toast.success("Tag verification test event dispatched!");
    } else {
      toast.info("Tags not detected on admin route (Admin tracking is disabled by default). Visit Trader App to test live.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 bg-[#161822] rounded-2xl border border-white/5">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
      </div>
    );
  }

  const cleanPixel = metaPixelId.trim();
  const cleanGtm = gtmId.trim();

  return (
    <div className="space-y-6">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161822] p-5 rounded-2xl border border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00A070]/10 rounded-xl text-[#00A070]">
              <Radio className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Tracking &amp; Pixels Management</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Configure Meta Pixel (Facebook Ads) and Google Tag Manager (GTM) containers with dynamic script injection and instant admin control.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleReset}
            disabled={resetting || saving}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
            title="Reset parameters to original IDs"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${resetting ? "animate-spin text-[#00A070]" : "text-gray-400"}`} />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-gray-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
            title="Reload settings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#00A070]" : ""}`} />
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Meta Pixel Card */}
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Meta Pixel</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  metaPixelEnabled && cleanPixel
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                }`}
              >
                {metaPixelEnabled && cleanPixel ? "Active" : "Disabled"}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between bg-[#11121A] p-2 rounded-xl border border-white/5">
              <div className="truncate">
                <span className="text-[10px] text-gray-500 block uppercase font-mono">Pixel ID</span>
                <span className="text-xs font-mono font-bold text-white">
                  {cleanPixel || "Not configured"}
                </span>
              </div>
              {cleanPixel && (
                <button
                  type="button"
                  onClick={() => handleCopy(cleanPixel, "pixelId")}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                  title="Copy Pixel ID"
                >
                  {copiedField === "pixelId" ? (
                    <Check className="w-3.5 h-3.5 text-[#00A070]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
            <span>Standard Events</span>
            <span className="text-emerald-400 font-medium">PageView (Auto)</span>
          </div>
        </div>

        {/* Google Tag Manager Card */}
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Google Tag Manager</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  gtmEnabled && cleanGtm
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                }`}
              >
                {gtmEnabled && cleanGtm ? "Active" : "Disabled"}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between bg-[#11121A] p-2 rounded-xl border border-white/5">
              <div className="truncate">
                <span className="text-[10px] text-gray-500 block uppercase font-mono">Container ID</span>
                <span className="text-xs font-mono font-bold text-white">
                  {cleanGtm || "Not configured"}
                </span>
              </div>
              {cleanGtm && (
                <button
                  type="button"
                  onClick={() => handleCopy(cleanGtm, "gtmId")}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                  title="Copy GTM Container ID"
                >
                  {copiedField === "gtmId" ? (
                    <Check className="w-3.5 h-3.5 text-[#00A070]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-400">
            <span>Container Mode</span>
            <span className="text-blue-400 font-medium">Head &amp; Noscript</span>
          </div>
        </div>

        {/* Admin Isolation Card */}
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">Admin Privacy Isolation</span>
              <Shield className="w-4 h-4 text-[#00A070]" />
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Prevent administrative sessions from skewing marketing funnels and conversion analytics.
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-gray-300 font-medium">Track on /admin routes</span>
            <button
              type="button"
              onClick={() => setTrackAdminPages(!trackAdminPages)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                trackAdminPages ? "bg-[#00A070]" : "bg-[#1E202B] border border-white/10"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white transition-transform block absolute top-1 ${
                  trackAdminPages ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Form Configuration */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Meta Pixel */}
        <div className="bg-[#161822] rounded-2xl border border-white/5 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Meta Pixel (Facebook Ads)</h2>
                <p className="text-xs text-gray-400">
                  Track website visits, customer conversions, and optimize Facebook/Instagram ad delivery.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-300 font-medium">
                {metaPixelEnabled ? "Pixel Enabled" : "Pixel Disabled"}
              </span>
              <button
                type="button"
                onClick={() => setMetaPixelEnabled(!metaPixelEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  metaPixelEnabled ? "bg-[#00A070]" : "bg-[#1E202B] border border-white/10"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white transition-transform block absolute top-1 ${
                    metaPixelEnabled ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input field */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                  <span>Meta Pixel ID</span>
                  <span className="text-[11px] text-gray-500 font-mono">15-16 Digits</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1412523413789691"
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value.replace(/\s+/g, ""))}
                  className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-3 px-3.5 text-xs text-white font-mono outline-none tracking-wide transition-colors"
                />
                <p className="text-[11px] text-gray-400">
                  Find your Pixel ID inside{" "}
                  <a
                    href="https://business.facebook.com/events_manager2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00A070] hover:underline inline-flex items-center gap-1"
                  >
                    Meta Events Manager <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  . Changing this ID updates tracking immediately across the entire site.
                </p>
              </div>

              {/* Advanced Custom Script Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMetaAdvanced(!showMetaAdvanced)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#00A070]" />
                  <span>{showMetaAdvanced ? "Hide Advanced Custom Meta Script" : "Show Advanced Custom Meta Script"}</span>
                </button>

                {showMetaAdvanced && (
                  <div className="mt-2.5 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">
                      Custom Meta Pixel Script Override (Optional)
                    </label>
                    <textarea
                      rows={5}
                      placeholder="<!-- Optional: Paste custom fbq code if you wish to override the automated standard snippet -->"
                      value={metaCustomScript}
                      onChange={(e) => setMetaCustomScript(e.target.value)}
                      className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-[11px] text-gray-200 font-mono outline-none"
                    />
                    <p className="text-[10px] text-gray-500">
                      Leave empty to use the standard high-performance automated script with Single Page App navigation tracking.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Live Generated Code Snippet Preview */}
            <div className="bg-[#11121A] rounded-xl border border-white/5 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-white/5">
                  <span className="font-semibold text-gray-300">Active Code Preview</span>
                  <span className="text-[10px] font-mono text-[#00A070] bg-[#00A070]/10 px-2 py-0.5 rounded">
                    Auto-generated
                  </span>
                </div>
                <pre className="mt-2.5 text-[10px] font-mono text-gray-300 overflow-x-auto p-2.5 bg-black/40 rounded-lg max-h-48 leading-relaxed">
{`<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${cleanPixel || "YOUR_PIXEL_ID"}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${cleanPixel || "YOUR_PIXEL_ID"}&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`}
                </pre>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00A070]" />
                  <span>React 19 &amp; Next.js 16 Compatible</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `<!-- Meta Pixel Code -->\n<script>\n!function(f,b,e,v,n,t,s)\n{if(f.fbq)return;n=f.fbq=function(){n.callMethod?\nn.callMethod.apply(n,arguments):n.queue.push(arguments)};\nif(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';\nn.queue=[];t=b.createElement(e);t.async=!0;\nt.src=v;s=b.getElementsByTagName(e)[0];\ns.parentNode.insertBefore(t,s)}(window, document,'script',\n'https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '${cleanPixel}');\nfbq('track', 'PageView');\n</script>\n<noscript><img height="1" width="1" style="display:none"\nsrc="https://www.facebook.com/tr?id=${cleanPixel}&ev=PageView&noscript=1"\n/></noscript>`,
                      "previewMeta"
                    )
                  }
                  className="text-xs text-[#00A070] hover:underline cursor-pointer"
                >
                  {copiedField === "previewMeta" ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Google Tag Manager */}
        <div className="bg-[#161822] rounded-2xl border border-white/5 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Google Tag Manager (GTM)</h2>
                <p className="text-xs text-gray-400">
                  Deploy Google Analytics 4, Google Ads tags, floodlights, and third-party tags without code deployments.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-300 font-medium">
                {gtmEnabled ? "GTM Enabled" : "GTM Disabled"}
              </span>
              <button
                type="button"
                onClick={() => setGtmEnabled(!gtmEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  gtmEnabled ? "bg-[#00A070]" : "bg-[#1E202B] border border-white/10"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white transition-transform block absolute top-1 ${
                    gtmEnabled ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input field */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                  <span>GTM Container ID</span>
                  <span className="text-[11px] text-gray-500 font-mono">Format: GTM-XXXXXXX</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. GTM-TD6VJP5R"
                  value={gtmId}
                  onChange={(e) => setGtmId(e.target.value.replace(/\s+/g, "").toUpperCase())}
                  className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-3 px-3.5 text-xs text-white font-mono outline-none tracking-wide transition-colors uppercase"
                />
                <p className="text-[11px] text-gray-400">
                  Manage your triggers and tags in{" "}
                  <a
                    href="https://tagmanager.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00A070] hover:underline inline-flex items-center gap-1"
                  >
                    Google Tag Manager Console <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  . Both &lt;head&gt; script and &lt;body&gt; noscript iframe are handled automatically.
                </p>
              </div>

              {/* Advanced Custom Script Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowGtmAdvanced(!showGtmAdvanced)}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Code2 className="w-3.5 h-3.5 text-[#00A070]" />
                  <span>{showGtmAdvanced ? "Hide Advanced Custom GTM Script" : "Show Advanced Custom GTM Script"}</span>
                </button>

                {showGtmAdvanced && (
                  <div className="mt-2.5 space-y-1.5">
                    <label className="text-xs font-semibold text-gray-300">
                      Custom GTM Script Override (Optional)
                    </label>
                    <textarea
                      rows={5}
                      placeholder="<!-- Optional: Paste custom GTM loader if using custom domain or server-side GTM proxy -->"
                      value={gtmCustomScript}
                      onChange={(e) => setGtmCustomScript(e.target.value)}
                      className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-[11px] text-gray-200 font-mono outline-none"
                    />
                    <p className="text-[10px] text-gray-500">
                      Leave empty to use the standard high-performance automated container loader.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Live Generated Code Snippet Preview */}
            <div className="bg-[#11121A] rounded-xl border border-white/5 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-white/5">
                  <span className="font-semibold text-gray-300">Active Container Preview</span>
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    Head &amp; Body
                  </span>
                </div>
                <pre className="mt-2.5 text-[10px] font-mono text-gray-300 overflow-x-auto p-2.5 bg-black/40 rounded-lg max-h-48 leading-relaxed">
{`<!-- Head: Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${cleanGtm || "GTM-XXXXXXX"}');</script>

<!-- Body: Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${cleanGtm || "GTM-XXXXXXX"}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`}
                </pre>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00A070]" />
                  <span>SPA Virtual Pageviews Enabled</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      `<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\nnew Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\nj=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n})(window,document,'script','dataLayer','${cleanGtm}');</script>\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${cleanGtm}"\nheight="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
                      "previewGtm"
                    )
                  }
                  className="text-xs text-[#00A070] hover:underline cursor-pointer"
                >
                  {copiedField === "previewGtm" ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Global Custom Code Injection */}
        <div className="bg-[#161822] rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Custom Scripts &amp; Additional Tags</h2>
                <p className="text-xs text-gray-400">
                  Inject additional third-party marketing tags (TikTok Pixel, Google Analytics GA4, Microsoft Clarity, Hotjar, etc.)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGlobalAdvanced(!showGlobalAdvanced)}
              className="text-xs text-[#00A070] hover:underline cursor-pointer font-semibold"
            >
              {showGlobalAdvanced ? "Collapse" : "Expand Fields"}
            </button>
          </div>

          {showGlobalAdvanced && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  Custom &lt;head&gt; Code
                </label>
                <textarea
                  rows={4}
                  placeholder="<!-- e.g. <script src='...'></script> or gtag('config', 'G-XXXX') -->"
                  value={customHeadCode}
                  onChange={(e) => setCustomHeadCode(e.target.value)}
                  className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-[11px] text-gray-200 font-mono outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">
                  Custom &lt;body&gt; Code
                </label>
                <textarea
                  rows={4}
                  placeholder="<!-- e.g. Chat widgets, bottom scripts, noscript fallbacks -->"
                  value={customBodyCode}
                  onChange={(e) => setCustomBodyCode(e.target.value)}
                  className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl p-3 text-[11px] text-gray-200 font-mono outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Live Diagnostic & Testing Panel */}
        <div className="bg-[#161822] rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Live Tag Verification &amp; Testing</h3>
                <p className="text-xs text-gray-400">
                  Dispatch a real-time verification event to confirm that script hooks are properly loaded.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunDiagnostic}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-[#00A070] border border-[#00A070]/20 hover:border-[#00A070]/40 transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Test Browser Tags</span>
            </button>
          </div>

          {testResult && (
            <div className="p-4 bg-[#11121A] rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{testResult.message}</span>
                <span className="text-[10px] text-gray-500 font-mono">Current Context: /admin</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs">
                  {testResult.fbqAvailable ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-500" />
                  )}
                  <span className={testResult.fbqAvailable ? "text-emerald-400 font-mono" : "text-gray-400 font-mono"}>
                    window.fbq: {testResult.fbqAvailable ? "Detected & Initialized" : "Not Active on /admin"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {testResult.gtmAvailable ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-500" />
                  )}
                  <span className={testResult.gtmAvailable ? "text-blue-400 font-mono" : "text-gray-400 font-mono"}>
                    window.dataLayer: {testResult.gtmAvailable ? "Detected & Ready" : "Not Active on /admin"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="text-[11px] text-gray-400 bg-[#12141C] p-3 rounded-xl border border-white/5 flex items-center justify-between">
            <span>Tip: To verify Pixel events on user pages, open any public page (e.g. /trade or /login) using the official Chrome extensions:</span>
            <div className="flex items-center gap-3">
              <a
                href="https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00A070] hover:underline font-semibold"
              >
                Meta Pixel Helper
              </a>
              <span className="text-gray-600">•</span>
              <a
                href="https://chromewebstore.google.com/detail/tag-assistant-legacy-by-g/kejbdijdndbnbjgmefkgdddjipokclnh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline font-semibold"
              >
                Google Tag Assistant
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="px-4 py-2.5 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
          >
            Reset Defaults
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Tracking Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}
