"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

export interface HeroSlideItem {
  id: string;
  badge?: string | null;
  title: string;
  subtitle?: string | null;
  bgType?: string;
  bgValue: string;
  badgeColor?: string;
  textColor?: string;
  subtitleColor?: string;
  btnText?: string | null;
  btnLink?: string | null;
  btnEnabled?: boolean;
  btnBgColor?: string;
  btnTextColor?: string;
  displayOrder?: number;
  enabled?: boolean;
}

interface HeroSliderProps {
  slides?: HeroSlideItem[];
  autoplayIntervalMs?: number;
}

export default function HeroSlider({
  slides = [],
  autoplayIntervalMs = 5000,
}: HeroSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // If no slides provided or empty, fallback gracefully
  const displaySlides = slides.length > 0 ? slides : [
    {
      id: "fallback-0",
      badge: "200+",
      title: "AIRDROPS",
      subtitle: "Every month for free!",
      bgType: "GRADIENT",
      bgValue: "from-blue-900 via-blue-800 to-indigo-900",
      badgeColor: "#FACC15",
      textColor: "#FFFFFF",
      subtitleColor: "#BFDBFE",
      btnText: "Claim Airdrop",
      btnLink: "/trade",
      btnEnabled: true,
      btnBgColor: "#FACC15",
      btnTextColor: "#000000",
    },
  ];

  const total = displaySlides.length;

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % total);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  };

  // Autoplay continuous infinite loop
  useEffect(() => {
    if (total <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, autoplayIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused, autoplayIntervalMs]);

  // Safe index within bounds without cascading render effect
  const safeIndex = total > 0 ? currentIndex % total : 0;
  const activeSlide = displaySlides[safeIndex] || displaySlides[0];

  // Determine background styling
  const getBackgroundStyle = (slide: HeroSlideItem) => {
    if (slide.bgType === "IMAGE" && slide.bgValue) {
      return {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${slide.bgValue})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    if (slide.bgValue?.startsWith("#") || slide.bgValue?.startsWith("linear-gradient")) {
      return { background: slide.bgValue };
    }
    return {};
  };

  const isGradientClass = (val: string) => {
    return val && (val.includes("from-") || val.includes("via-") || val.includes("to-"));
  };

  return (
    <div
      className="relative px-3 sm:px-4 py-2 select-none group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      <div
        className={`relative w-full min-h-[170px] h-44 sm:h-48 md:h-52 rounded-2xl p-4 sm:p-6 sm:p-7 overflow-hidden transition-all duration-700 ease-out shadow-xl flex flex-col justify-between ${
          isGradientClass(activeSlide.bgValue)
            ? `bg-gradient-to-r ${activeSlide.bgValue}`
            : ""
        }`}
        style={getBackgroundStyle(activeSlide)}
      >
        {/* Seamless Ambient Radial Glow (Full-bleed, no box edges or clipping artifacts) */}
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-700"
          style={{
            background: `radial-gradient(circle at 85% 35%, ${activeSlide.badgeColor || "#00A070"}22 0%, transparent 60%)`,
          }}
        />

        {/* Subtle Decorative Geometric Rings (Right side fintech watermark) */}
        <div className="absolute -right-10 -top-10 w-64 h-64 pointer-events-none select-none opacity-[0.06] hidden sm:block">
          <div className="w-full h-full rounded-full border border-white" />
          <div className="absolute inset-8 rounded-full border border-white" />
          <div className="absolute inset-16 rounded-full border border-white" />
        </div>

        {/* Content Area */}
        <div 
          key={activeSlide.id}
          className="relative z-10 max-w-lg flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-500"
        >
          {/* Badge & Title */}
          <div className="flex flex-col">
            {activeSlide.badge && (
              <span
                className="text-2xl sm:text-3xl font-black tracking-tight leading-none drop-shadow-sm font-sans"
                style={{ color: activeSlide.badgeColor || "#FACC15" }}
              >
                {activeSlide.badge}
              </span>
            )}
            <h2
              className="text-2xl sm:text-3xl font-black tracking-tight uppercase leading-tight drop-shadow-md font-sans mt-0.5"
              style={{ color: activeSlide.textColor || "#FFFFFF" }}
            >
              {activeSlide.title}
            </h2>
          </div>

          {/* Subtitle / Description */}
          {activeSlide.subtitle && (
            <p
              className="text-xs sm:text-sm font-medium mt-1.5 line-clamp-2 drop-shadow-sm"
              style={{ color: activeSlide.subtitleColor || "#BFDBFE" }}
            >
              {activeSlide.subtitle}
            </p>
          )}

          {/* CTA Button */}
          {activeSlide.btnEnabled && activeSlide.btnText && (
            <div className="mt-3">
              <Link
                href={activeSlide.btnLink || "/trade"}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold shadow-lg transition-all transform active:scale-95 hover:brightness-110 cursor-pointer"
                style={{
                  backgroundColor: activeSlide.btnBgColor || "#00A070",
                  color: activeSlide.btnTextColor || "#FFFFFF",
                }}
              >
                <span>{activeSlide.btnText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Navigation Arrows (Visible on hover on desktop, or subtle on touch) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-20 backdrop-blur-xs"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 border border-white/10 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-20 backdrop-blur-xs"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Bottom Slide Indicators */}
        {total > 1 && (
          <div className="absolute bottom-2.5 right-4 z-20 flex items-center gap-1.5">
            {displaySlides.map((s, index) => {
              const isActive = index === safeIndex;
              return (
                <button
                  key={s.id || index}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    isActive
                      ? "w-6 bg-white shadow-sm"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
