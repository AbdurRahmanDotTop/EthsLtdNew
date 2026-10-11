"use client";

import { useState, useEffect } from "react";
import { 
  Presentation, 
  Plus, 
  Edit3, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Check, 
  X, 
  Loader2, 
  Sparkles,
  ExternalLink,
  Layers,
  Palette,
  MousePointerClick
} from "lucide-react";
import { 
  getAllHeroSlidesAdmin, 
  createHeroSlide, 
  updateHeroSlide, 
  deleteHeroSlide, 
  toggleHeroSlideStatus, 
  reorderHeroSlides 
} from "@/actions/slider";
import HeroSlider, { HeroSlideItem } from "@/components/home/HeroSlider";
import { toast } from "sonner";

const GRADIENT_PRESETS = [
  { name: "Deep Blue (Default)", value: "from-blue-900 via-blue-800 to-indigo-900", color: "#1E40AF" },
  { name: "Emerald Forest", value: "from-emerald-950 via-[#0A261D] to-[#003824]", color: "#00A070" },
  { name: "Royal Purple", value: "from-purple-950 via-[#260A38] to-[#380034]", color: "#9333EA" },
  { name: "Midnight Navy", value: "from-[#0B0E29] via-[#10152F] to-[#1A2144]", color: "#1E293B" },
  { name: "Sunset Crimson", value: "from-[#3B0712] via-[#2A0510] to-[#1A030A]", color: "#E11D48" },
  { name: "Golden Amber", value: "from-[#38260A] via-[#281B07] to-[#1A1104]", color: "#D97706" },
];

const COLOR_PRESETS = [
  { name: "Gold", value: "#FACC15" },
  { name: "Brand Green", value: "#00A070" },
  { name: "Sky Blue", value: "#38BDF8" },
  { name: "Purple", value: "#C084FC" },
  { name: "Rose Pink", value: "#FB7185" },
  { name: "White", value: "#FFFFFF" },
  { name: "Black", value: "#000000" },
];

const LINK_PRESETS = [
  { label: "Perpetual Trade (/trade)", value: "/trade" },
  { label: "Options Trade (/options)", value: "/options" },
  { label: "Deposit (/assets/deposit)", value: "/assets/deposit" },
  { label: "Assets Wallet (/assets)", value: "/assets" },
  { label: "KYC Verification (/profile/kyc)", value: "/profile/kyc" },
];

export default function AdminHeroSliderPage() {
  const [slides, setSlides] = useState<HeroSlideItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit / Create Modal state
  const [editingSlide, setEditingSlide] = useState<HeroSlideItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [badge, setBadge] = useState("");
  const [badgeColor, setBadgeColor] = useState("#FACC15");
  const [title, setTitle] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [subtitle, setSubtitle] = useState("");
  const [subtitleColor, setSubtitleColor] = useState("#BFDBFE");
  const [bgType, setBgType] = useState<"GRADIENT" | "SOLID" | "IMAGE">("GRADIENT");
  const [bgValue, setBgValue] = useState("from-blue-900 via-blue-800 to-indigo-900");
  const [btnText, setBtnText] = useState("Claim Now");
  const [btnLink, setBtnLink] = useState("/trade");
  const [btnEnabled, setBtnEnabled] = useState(true);
  const [btnBgColor, setBtnBgColor] = useState("#00A070");
  const [btnTextColor, setBtnTextColor] = useState("#FFFFFF");
  const [enabled, setEnabled] = useState(true);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSlides = async () => {
    try {
      const data = await getAllHeroSlidesAdmin();
      setSlides(data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load hero slides");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSlides();
  }, []);

  const openCreateModal = () => {
    setBadge("NEW");
    setBadgeColor("#FACC15");
    setTitle("CRYPTO PROMO");
    setTextColor("#FFFFFF");
    setSubtitle("Trade top digital assets with zero fees today!");
    setSubtitleColor("#BFDBFE");
    setBgType("GRADIENT");
    setBgValue("from-blue-900 via-blue-800 to-indigo-900");
    setBtnText("Start Now");
    setBtnLink("/trade");
    setBtnEnabled(true);
    setBtnBgColor("#00A070");
    setBtnTextColor("#FFFFFF");
    setEnabled(true);

    setEditingSlide(null);
    setIsCreating(true);
  };

  const openEditModal = (slide: HeroSlideItem) => {
    setEditingSlide(slide);
    setBadge(slide.badge || "");
    setBadgeColor(slide.badgeColor || "#FACC15");
    setTitle(slide.title);
    setTextColor(slide.textColor || "#FFFFFF");
    setSubtitle(slide.subtitle || "");
    setSubtitleColor(slide.subtitleColor || "#BFDBFE");
    setBgType((slide.bgType as any) || "GRADIENT");
    setBgValue(slide.bgValue);
    setBtnText(slide.btnText || "");
    setBtnLink(slide.btnLink || "/trade");
    setBtnEnabled(slide.btnEnabled ?? true);
    setBtnBgColor(slide.btnBgColor || "#00A070");
    setBtnTextColor(slide.btnTextColor || "#FFFFFF");
    setEnabled(slide.enabled ?? true);

    setIsCreating(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a slide heading/title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        badge: badge.trim() || undefined,
        badgeColor,
        title: title.trim(),
        textColor,
        subtitle: subtitle.trim() || undefined,
        subtitleColor,
        bgType,
        bgValue: bgValue.trim(),
        btnText: btnText.trim() || undefined,
        btnLink: btnLink.trim() || "/trade",
        btnEnabled,
        btnBgColor,
        btnTextColor,
        enabled,
      };

      if (isCreating) {
        const res = await createHeroSlide(payload);
        if (res.success) {
          toast.success("New hero slide created and published successfully!");
          setIsCreating(false);
          loadSlides();
        } else {
          toast.error(res.error || "Failed to create slide");
        }
      } else if (editingSlide) {
        const res = await updateHeroSlide(editingSlide.id, payload);
        if (res.success) {
          toast.success("Hero slide updated successfully!");
          setEditingSlide(null);
          loadSlides();
        } else {
          toast.error(res.error || "Failed to update slide");
        }
      }
    } catch (e: any) {
      toast.error(e.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteHeroSlide(id);
      if (res.success) {
        toast.success("Slide deleted successfully");
        setDeletingId(null);
        loadSlides();
      } else {
        toast.error(res.error || "Failed to delete slide");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    try {
      const res = await toggleHeroSlideStatus(id, !currentStatus);
      if (res.success) {
        toast.success(`Slide ${!currentStatus ? "activated" : "deactivated"} successfully`);
        setSlides((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: !currentStatus } : s))
        );
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const newSlides = [...slides];
    const [moved] = newSlides.splice(index, 1);
    newSlides.splice(targetIndex, 0, moved);

    setSlides(newSlides);
    try {
      await reorderHeroSlides(newSlides.map((s) => s.id));
      toast.success("Slide order updated!");
    } catch (e: any) {
      toast.error("Failed to reorder slides");
      loadSlides();
    }
  };

  // Preview item for modal
  const previewItem: HeroSlideItem = {
    id: "preview-slide",
    badge: badge.trim() || undefined,
    badgeColor,
    title: title.trim() || "SLIDE TITLE",
    textColor,
    subtitle: subtitle.trim() || undefined,
    subtitleColor,
    bgType,
    bgValue,
    btnText: btnText.trim() || undefined,
    btnLink,
    btnEnabled,
    btnBgColor,
    btnTextColor,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Presentation className="w-6 h-6 text-[#00A070]" />
            Hero Section Slider Management
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage automatic rotating slides on the home page. Customize headings, badges, colors, and CTA action buttons.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Slide</span>
        </button>
      </div>

      {/* Live Homepage Simulation Preview Box */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#00A070]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Live Home Page Preview
            </span>
          </div>
          <span className="text-[11px] text-gray-400 font-mono">
            Active Slides: {slides.filter((s) => s.enabled).length} / {slides.length}
          </span>
        </div>

        {/* Real Live Render of HeroSlider */}
        <div className="max-w-2xl mx-auto py-2">
          <HeroSlider slides={slides.filter((s) => s.enabled)} autoplayIntervalMs={4000} />
        </div>
      </div>

      {/* Slides Management Table / List */}
      <div className="bg-[#161822] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00A070]" />
            All Hero Slides ({slides.length})
          </h3>
          <span className="text-xs text-gray-500 font-mono">
            Use arrows to reorder display sequence
          </span>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center text-[#00A070]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : slides.length === 0 ? (
          <div className="py-20 text-center text-xs text-gray-500">
            No slides configured. Click &ldquo;Add New Slide&rdquo; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1E202B] text-gray-400 uppercase font-mono text-[10px] border-b border-white/5">
                <tr>
                  <th className="px-4 py-3 text-center w-16">Order</th>
                  <th className="px-4 py-3">Badge & Title</th>
                  <th className="px-4 py-3">Subtitle</th>
                  <th className="px-4 py-3">Background</th>
                  <th className="px-4 py-3">CTA Button</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {slides.map((slide, index) => (
                  <tr key={slide.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Order Controls */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMove(index, "up")}
                          className="p-1 rounded bg-[#1A1C24] hover:bg-[#252836] disabled:opacity-20 text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === slides.length - 1}
                          onClick={() => handleMove(index, "down")}
                          className="p-1 rounded bg-[#1A1C24] hover:bg-[#252836] disabled:opacity-20 text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Badge & Title */}
                    <td className="px-4 py-3.5">
                      <div>
                        {slide.badge && (
                          <span
                            className="font-mono text-[10px] font-black uppercase block"
                            style={{ color: slide.badgeColor || "#FACC15" }}
                          >
                            {slide.badge}
                          </span>
                        )}
                        <span
                          className="font-bold text-sm block"
                          style={{ color: slide.textColor || "#FFFFFF" }}
                        >
                          {slide.title}
                        </span>
                      </div>
                    </td>

                    {/* Subtitle */}
                    <td className="px-4 py-3.5 text-gray-300 max-w-[200px] truncate" title={slide.subtitle || ""}>
                      {slide.subtitle || <span className="text-gray-600 italic">None</span>}
                    </td>

                    {/* Background Preview */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-10 h-6 rounded-md border border-white/10 shadow-xs ${
                            slide.bgValue.includes("from-")
                              ? `bg-gradient-to-r ${slide.bgValue}`
                              : ""
                          }`}
                          style={
                            !slide.bgValue.includes("from-")
                              ? { background: slide.bgValue }
                              : {}
                          }
                        />
                        <span className="text-[10px] font-mono text-gray-400 max-w-[100px] truncate">
                          {slide.bgType}
                        </span>
                      </div>
                    </td>

                    {/* CTA Button */}
                    <td className="px-4 py-3.5">
                      {slide.btnEnabled && slide.btnText ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="px-2.5 py-1 rounded-md text-[10px] font-bold shadow-xs whitespace-nowrap"
                            style={{
                              backgroundColor: slide.btnBgColor || "#00A070",
                              color: slide.btnTextColor || "#FFFFFF",
                            }}
                          >
                            {slide.btnText}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            &rarr; {slide.btnLink}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-[10px] italic">Disabled</span>
                      )}
                    </td>

                    {/* Status Toggle Switch */}
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(slide.id, !!slide.enabled)}
                        className={`w-11 h-6 rounded-full transition-colors relative inline-flex items-center p-0.5 cursor-pointer ${
                          slide.enabled ? "bg-[#00A070]" : "bg-gray-700"
                        }`}
                        title={slide.enabled ? "Click to disable" : "Click to enable"}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            slide.enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(slide)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Edit Slide"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(slide.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                          title="Delete Slide"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide Edit / Create Modal */}
      {(isCreating || editingSlide) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md overflow-y-auto py-8 animate-in fade-in">
          <div className="w-full max-w-2xl bg-[#161822] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white font-sans max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/5 bg-[#1E202B]">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#00A070]" />
                <h3 className="text-base font-bold text-white">
                  {isCreating ? "Create New Hero Slide" : "Edit Hero Slide"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingSlide(null);
                }}
                className="p-1.5 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Real-time preview inside modal */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold font-mono">
                  Live Preview:
                </span>
                <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40">
                  <HeroSlider slides={[previewItem]} autoplayIntervalMs={999999} />
                </div>
              </div>

              {/* Section 1: Content Customization */}
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3.5">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                  1. Text & Headings
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Badge / Top Tag (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 200+ or 100x LEVERAGE"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      className="w-full bg-[#1A1C24] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#00A070]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Badge Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={badgeColor}
                        onChange={(e) => setBadgeColor(e.target.value)}
                        className="flex-1 bg-[#1A1C24] border border-white/10 rounded-lg p-2 text-xs font-mono text-white outline-none"
                      />
                      <input
                        type="color"
                        value={badgeColor}
                        onChange={(e) => setBadgeColor(e.target.value)}
                        className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Main Heading / Title <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. AIRDROPS or PERPETUAL TRADING"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#1A1C24] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#00A070]"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Heading Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="flex-1 bg-[#1A1C24] border border-white/10 rounded-lg p-2 text-xs font-mono text-white outline-none"
                      />
                      <input
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Subtitle / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Every month for free!"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="w-full bg-[#1A1C24] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#00A070]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      Subtitle Color
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={subtitleColor}
                        onChange={(e) => setSubtitleColor(e.target.value)}
                        className="flex-1 bg-[#1A1C24] border border-white/10 rounded-lg p-2 text-xs font-mono text-white outline-none"
                      />
                      <input
                        type="color"
                        value={subtitleColor}
                        onChange={(e) => setSubtitleColor(e.target.value)}
                        className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Background Customization */}
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3.5">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono">
                  2. Background Styling
                </h4>

                <div>
                  <label className="text-xs text-gray-400 block mb-1.5">
                    Select Gradient Preset:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {GRADIENT_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setBgType("GRADIENT");
                          setBgValue(preset.value);
                        }}
                        className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          bgValue === preset.value
                            ? "border-[#00A070] bg-[#00A070]/10 text-white"
                            : "border-white/10 hover:border-white/20 text-gray-400"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-gradient-to-r ${preset.value}`}
                        />
                        <span className="text-[11px] truncate font-medium">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    Custom Gradient Classes, Hex Color, or CSS:
                  </label>
                  <input
                    type="text"
                    value={bgValue}
                    onChange={(e) => setBgValue(e.target.value)}
                    className="w-full bg-[#1A1C24] border border-white/10 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-[#00A070]"
                  />
                </div>
              </div>

              {/* Section 3: Interactive CTA Button */}
              <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <MousePointerClick className="w-4 h-4 text-[#00A070]" />
                    3. Interactive Call to Action (CTA) Button
                  </h4>
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={btnEnabled}
                      onChange={(e) => setBtnEnabled(e.target.checked)}
                      className="accent-[#00A070]"
                    />
                    <span>Enable Button</span>
                  </label>
                </div>

                {btnEnabled && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Button Label
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Claim Now, Trade Now"
                          value={btnText}
                          onChange={(e) => setBtnText(e.target.value)}
                          className="w-full bg-[#1A1C24] border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#00A070]"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Destination Link / Target URL
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. /trade, /options"
                          value={btnLink}
                          onChange={(e) => setBtnLink(e.target.value)}
                          className="w-full bg-[#1A1C24] border border-white/10 rounded-lg p-2.5 text-xs font-mono text-white outline-none focus:border-[#00A070]"
                        />
                      </div>
                    </div>

                    {/* Quick Link Targets */}
                    <div>
                      <span className="text-[10px] text-gray-500 font-mono block mb-1">
                        Quick Screen Presets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {LINK_PRESETS.map((link) => (
                          <button
                            key={link.value}
                            type="button"
                            onClick={() => setBtnLink(link.value)}
                            className={`text-[10px] px-2 py-1 rounded border transition-colors cursor-pointer ${
                              btnLink === link.value
                                ? "bg-[#00A070] text-white border-[#00A070]"
                                : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                            }`}
                          >
                            {link.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Button Colors */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Button Background Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={btnBgColor}
                            onChange={(e) => setBtnBgColor(e.target.value)}
                            className="flex-1 bg-[#1A1C24] border border-white/10 rounded-lg p-2 text-xs font-mono text-white outline-none"
                          />
                          <input
                            type="color"
                            value={btnBgColor}
                            onChange={(e) => setBtnBgColor(e.target.value)}
                            className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-400 block mb-1">
                          Button Text Color
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={btnTextColor}
                            onChange={(e) => setBtnTextColor(e.target.value)}
                            className="flex-1 bg-[#1A1C24] border border-white/10 rounded-lg p-2 text-xs font-mono text-white outline-none"
                          />
                          <input
                            type="color"
                            value={btnTextColor}
                            onChange={(e) => setBtnTextColor(e.target.value)}
                            className="w-8 h-8 rounded border border-white/10 cursor-pointer bg-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingSlide(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1A1C24] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#00A070] hover:bg-[#00b880] text-white font-bold text-xs shadow-lg shadow-[#00A070]/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{isCreating ? "Publish Slide" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161822] border border-white/10 rounded-2xl p-5 shadow-2xl text-white font-sans">
            <h3 className="text-base font-bold text-white mb-2">Delete Hero Slide?</h3>
            <p className="text-xs text-gray-400 mb-5">
              Are you sure you want to delete this hero slide? This action will remove it from the home page rotation immediately.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white bg-[#1E202B] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deletingId)}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 cursor-pointer transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
