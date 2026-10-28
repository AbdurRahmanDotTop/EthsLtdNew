"use client";

import { useEffect, useState } from "react";
import { getSitemapDataAdmin, regenerateSitemapAdmin, SitemapAdminData } from "@/actions/sitemap";
import { SitemapEntry } from "@/lib/sitemap";
import {
  Globe,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  FileCode,
  ShieldAlert,
  Search,
  SlidersHorizontal,
  Compass,
  Layers,
  Sparkles,
  Loader2,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminSitemapPage() {
  const [data, setData] = useState<SitemapAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showXmlPreview, setShowXmlPreview] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getSitemapDataAdmin();
      if (res.success) {
        setData(res);
      } else {
        toast.error(res.error || "Failed to load sitemap data.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Error loading sitemap.");
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

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await regenerateSitemapAdmin();
      if (res.success) {
        toast.success(`Sitemap successfully regenerated with ${res.totalCount} URLs!`);
        await loadData();
      } else {
        toast.error(res.error || "Failed to regenerate sitemap.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "An unexpected error occurred while regenerating.");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 bg-[#161822] rounded-2xl border border-white/5">
        <Loader2 className="w-8 h-8 animate-spin text-[#00A070]" />
      </div>
    );
  }

  const sitemapUrl = `${data?.baseUrl || "https://ethsltd.com"}/sitemap.xml`;
  const robotsUrl = `${data?.baseUrl || "https://ethsltd.com"}/robots.txt`;

  const filteredEntries = (data?.entries || []).filter((item) => {
    const matchesSearch = item.loc.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161822] p-5 rounded-2xl border border-white/5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00A070]/10 rounded-xl text-[#00A070]">
              <Globe className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Dynamic Sitemap &amp; SEO Management</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Real-time XML sitemap generation for search engines (Google, Bing). Automatically includes active markets, trading pairs, and excludes restricted user/admin routes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
          >
            <span>Live XML</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#00A070]" />
          </a>
          <a
            href="/robots.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1E202B] hover:bg-[#252836] text-xs font-semibold text-gray-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
          >
            <span>robots.txt</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          </a>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#00A070] to-emerald-500 hover:from-[#00b880] hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
            <span>{regenerating ? "Regenerating..." : "Regenerate Sitemap"}</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics & Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total URLs */}
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold">Indexed Public URLs</span>
            <span className="p-1.5 rounded-lg bg-[#00A070]/10 text-[#00A070]">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-white font-mono">
              {data?.totalCount || 0}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Active markets &amp; public pages
            </p>
          </div>
        </div>

        {/* Sitemap Canonical URL */}
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold">Sitemap Canonical URL</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
              Canonical
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between bg-[#11121A] p-2 rounded-xl border border-white/5">
            <span className="text-xs font-mono text-gray-200 truncate max-w-[180px]">
              /sitemap.xml
            </span>
            <button
              onClick={() => handleCopy(sitemapUrl, "sitemapUrl")}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              title="Copy Full URL"
            >
              {copiedField === "sitemapUrl" ? (
                <Check className="w-3.5 h-3.5 text-[#00A070]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Robots.txt Directive */}
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold">Robots.txt Directive</span>
            <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
              Active
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between bg-[#11121A] p-2 rounded-xl border border-white/5">
            <span className="text-xs font-mono text-gray-200 truncate max-w-[180px]">
              /robots.txt
            </span>
            <button
              onClick={() => handleCopy(robotsUrl, "robotsUrl")}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              title="Copy Full URL"
            >
              {copiedField === "robotsUrl" ? (
                <Check className="w-3.5 h-3.5 text-[#00A070]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Excluded Restricted Routes */}
        <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-xs font-semibold">Security Exclusions</span>
            <Lock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3">
            <div className="text-xs font-mono text-rose-300 font-bold">
              11 Protected Paths
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              /admin, /api, /account, /assets, /security
            </p>
          </div>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="bg-[#161822] p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 [scrollbar-width:none]">
          {[
            { id: "ALL", label: `All (${data?.totalCount || 0})` },
            { id: "core", label: `Core (${data?.categoriesCount?.core || 0})` },
            { id: "trading", label: `Trading (${data?.categoriesCount?.trading || 0})` },
            { id: "options", label: `Options (${data?.categoriesCount?.options || 0})` },
            { id: "asset", label: `Assets (${data?.categoriesCount?.asset || 0})` },
            { id: "advisory", label: `Advisory (${data?.categoriesCount?.advisory || 0})` },
            { id: "auth", label: `Auth (${data?.categoriesCount?.auth || 0})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-[#00A070] text-white shadow-sm"
                  : "bg-[#11121A] text-gray-400 hover:text-white hover:bg-[#1E202B]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search URLs or market pairs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#11121A] border border-white/10 focus:border-[#00A070] rounded-xl py-2 pl-9 pr-3.5 text-xs text-white outline-none"
          />
        </div>
      </div>

      {/* 4. URL Inspection Table */}
      <div className="bg-[#161822] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Eligible Sitemap URLs</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Showing {filteredEntries.length} of {data?.totalCount || 0} indexed endpoints
            </p>
          </div>
          <button
            onClick={() => setShowXmlPreview(!showXmlPreview)}
            className="flex items-center gap-1.5 text-xs text-[#00A070] hover:underline cursor-pointer font-semibold"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{showXmlPreview ? "Hide XML Source" : "View Raw XML"}</span>
          </button>
        </div>

        {/* Collapsible Raw XML Preview */}
        {showXmlPreview && (
          <div className="p-4 bg-[#11121A] border-b border-white/5">
            <div className="flex items-center justify-between pb-2 text-xs text-gray-400">
              <span className="font-mono text-gray-300">Generated XML Output</span>
              <button
                onClick={() => handleCopy(data?.xmlPreview || "", "rawXml")}
                className="text-[#00A070] hover:underline text-xs flex items-center gap-1"
              >
                {copiedField === "rawXml" ? "Copied XML!" : "Copy Full XML"}
              </button>
            </div>
            <pre className="text-[11px] font-mono text-emerald-300 bg-black/50 p-3 rounded-xl overflow-x-auto max-h-64 [scrollbar-width:thin]">
              {data?.xmlPreview}
            </pre>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead>
              <tr className="bg-[#12141C] text-gray-400 border-b border-white/5 font-semibold">
                <th className="py-3 px-4">Destination URL</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Last Modified</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {filteredEntries.map((item, idx) => (
                <tr key={idx} className="hover:bg-[#1A1D2B] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono text-white text-xs truncate max-w-md" title={item.loc}>
                      {item.loc}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        item.category === "core"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : item.category === "trading"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : item.category === "options"
                          ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
                          : item.category === "asset"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : item.category === "advisory"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                      }`}
                    >
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-gray-200">
                    {item.priority.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">
                    {item.changefreq}
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-500 text-[11px] whitespace-nowrap">
                    {item.lastmod ? new Date(item.lastmod).toLocaleString() : "Real-time"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <a
                      href={item.loc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E202B] hover:bg-[#252836] text-[11px] text-[#00A070] font-medium transition-colors"
                    >
                      <span>Visit</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Exclusion Policy & Best Practices Note */}
      <div className="bg-[#161822] rounded-2xl border border-white/5 p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <ShieldAlert className="w-4 h-4 text-[#00A070]" />
          <span>SEO Security &amp; Dynamic Inclusion Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
          <div className="space-y-1.5 p-3.5 bg-[#11121A] rounded-xl border border-white/5">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Automated Dynamic Inclusions</span>
            </span>
            <p className="text-[11px] leading-relaxed">
              Whenever you create or activate a new market pair in <strong>/admin/markets</strong> (e.g. SOL/USDT, DOGE/USDT), or add a new crypto asset, it is automatically included in the sitemap XML without requiring manual code edits.
            </p>
          </div>
          <div className="space-y-1.5 p-3.5 bg-[#11121A] rounded-xl border border-white/5">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Strict Privacy Exclusions</span>
            </span>
            <p className="text-[11px] leading-relaxed">
              Sensitive user dashboards (<strong>/assets</strong>, <strong>/account</strong>, <strong>/profile</strong>), financial transactions, KYC documents, admin console (<strong>/admin/*</strong>), and API routes are strictly excluded from the sitemap and blocked in <strong>/robots.txt</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
