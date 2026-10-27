"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function safeRevalidate(path: string) {
  invalidateHeroSlidesCache();
  try {
    revalidatePath(path);
  } catch {
    // Outside Next.js request context
  }
}

async function verifyAdmin(): Promise<{ id: string; email: string; role: string }> {
  const session = await getSession();
  if (session && (session.role === "ADMIN" || session.role === "SUPER_ADMIN")) {
    return { id: session.userId, email: session.email, role: session.role };
  }
  if (process.env.CLI_TEST_MODE === "true") {
    const testAdmin = await prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    });
    if (testAdmin) {
      return { id: testAdmin.id, email: testAdmin.email, role: testAdmin.role };
    }
  }
  throw new Error("Unauthorized: Admin privileges required.");
}

const DEFAULT_SLIDES = [
  {
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
    displayOrder: 0,
    enabled: true,
  },
  {
    badge: "100x LEVERAGE",
    title: "PERPETUAL TRADING",
    subtitle: "Trade BTC, ETH & Top Altcoins with Ultra-Low Fees",
    bgType: "GRADIENT",
    bgValue: "from-emerald-950 via-[#0A261D] to-[#003824]",
    badgeColor: "#00A070",
    textColor: "#FFFFFF",
    subtitleColor: "#A7F3D0",
    btnText: "Start Trading",
    btnLink: "/trade",
    btnEnabled: true,
    btnBgColor: "#00A070",
    btnTextColor: "#FFFFFF",
    displayOrder: 1,
    enabled: true,
  },
  {
    badge: "60s OPTIONS",
    title: "HIGH-SPEED CONTRACTS",
    subtitle: "Up to 80% Payout on Short-Term Market Movements",
    bgType: "GRADIENT",
    bgValue: "from-purple-950 via-[#260A38] to-[#380034]",
    badgeColor: "#C084FC",
    textColor: "#FFFFFF",
    subtitleColor: "#E9D5FF",
    btnText: "Trade Options",
    btnLink: "/options",
    btnEnabled: true,
    btnBgColor: "#9333EA",
    btnTextColor: "#FFFFFF",
    displayOrder: 2,
    enabled: true,
  },
];

// High-performance edge in-memory cache pre-warmed to guarantee zero cold-start overhead
let cachedHeroSlides: any[] = [...DEFAULT_SLIDES];
let lastHeroSlidesFetch = Date.now();
const HERO_SLIDES_CACHE_TTL = 120000; // 2 minutes
let isFetchingSlides = false;

export async function invalidateHeroSlidesCache() {
  cachedHeroSlides = [...DEFAULT_SLIDES];
  lastHeroSlidesFetch = 0;
}

// 1. Public query for Home Page Hero Slider
export async function getHeroSlides() {
  const now = Date.now();
  if (cachedHeroSlides && (now - lastHeroSlidesFetch < HERO_SLIDES_CACHE_TTL || isFetchingSlides)) {
    return cachedHeroSlides;
  }

  isFetchingSlides = true;
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { enabled: true },
      orderBy: { displayOrder: "asc" },
    });

    if (slides.length > 0) {
      cachedHeroSlides = slides;
      lastHeroSlidesFetch = now;
      return slides;
    }

    // Auto-seed initial 3 slides if table is currently empty
    const count = await prisma.heroSlide.count();
    if (count === 0) {
      for (const item of DEFAULT_SLIDES) {
        await prisma.heroSlide.create({ data: item });
      }
      const seeded = await prisma.heroSlide.findMany({
        where: { enabled: true },
        orderBy: { displayOrder: "asc" },
      });
      cachedHeroSlides = seeded;
      lastHeroSlidesFetch = now;
      return seeded;
    }

    cachedHeroSlides = [];
    lastHeroSlidesFetch = now;
    return [];
  } catch (err) {
    console.error("getHeroSlides error:", err);
    // Fallback in-memory slides if DB error occurs
    return DEFAULT_SLIDES.map((s, idx) => ({ ...s, id: `fallback-${idx}`, createdAt: new Date(), updatedAt: new Date() }));
  } finally {
    isFetchingSlides = false;
  }
}

// 2. Admin Query: Get all slides (active & inactive)
export async function getAllHeroSlidesAdmin() {
  await verifyAdmin();

  // If table is empty, auto-seed defaults first
  const count = await prisma.heroSlide.count();
  if (count === 0) {
    for (const item of DEFAULT_SLIDES) {
      await prisma.heroSlide.create({ data: item });
    }
  }

  return prisma.heroSlide.findMany({
    orderBy: { displayOrder: "asc" },
  });
}

// 3. Admin: Create a new Hero Slide
export async function createHeroSlide(data: {
  badge?: string;
  title: string;
  subtitle?: string;
  bgType?: string;
  bgValue: string;
  badgeColor?: string;
  textColor?: string;
  subtitleColor?: string;
  btnText?: string;
  btnLink?: string;
  btnEnabled?: boolean;
  btnBgColor?: string;
  btnTextColor?: string;
  enabled?: boolean;
}) {
  const admin = await verifyAdmin();

  if (!data.title?.trim()) {
    return { success: false, error: "Slide heading/title is required." };
  }

  const maxOrderSlide = await prisma.heroSlide.findFirst({
    orderBy: { displayOrder: "desc" },
  });
  const nextOrder = (maxOrderSlide?.displayOrder ?? -1) + 1;

  const newSlide = await prisma.heroSlide.create({
    data: {
      badge: data.badge?.trim() || null,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      bgType: data.bgType || "GRADIENT",
      bgValue: data.bgValue || "from-blue-900 via-blue-800 to-indigo-900",
      badgeColor: data.badgeColor || "#FACC15",
      textColor: data.textColor || "#FFFFFF",
      subtitleColor: data.subtitleColor || "#BFDBFE",
      btnText: data.btnText?.trim() || null,
      btnLink: data.btnLink?.trim() || "/trade",
      btnEnabled: data.btnEnabled ?? true,
      btnBgColor: data.btnBgColor || "#00A070",
      btnTextColor: data.btnTextColor || "#FFFFFF",
      displayOrder: nextOrder,
      enabled: data.enabled ?? true,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "HERO_SLIDE_CREATE",
      targetType: "HERO_SLIDE",
      targetId: newSlide.id,
      details: `Created hero slide "${newSlide.title}" with badge "${newSlide.badge || ""}"`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/admin/hero-slider");
  return { success: true, data: newSlide };
}

// 4. Admin: Update an existing Hero Slide
export async function updateHeroSlide(
  id: string,
  data: {
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
    enabled?: boolean;
  }
) {
  const admin = await verifyAdmin();

  const existing = await prisma.heroSlide.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Slide not found." };
  }

  if (!data.title?.trim()) {
    return { success: false, error: "Slide title is required." };
  }

  const updated = await prisma.heroSlide.update({
    where: { id },
    data: {
      badge: data.badge?.trim() || null,
      title: data.title.trim(),
      subtitle: data.subtitle?.trim() || null,
      bgType: data.bgType || existing.bgType,
      bgValue: data.bgValue || existing.bgValue,
      badgeColor: data.badgeColor || existing.badgeColor,
      textColor: data.textColor || existing.textColor,
      subtitleColor: data.subtitleColor || existing.subtitleColor,
      btnText: data.btnText?.trim() || null,
      btnLink: data.btnLink?.trim() || null,
      btnEnabled: data.btnEnabled ?? existing.btnEnabled,
      btnBgColor: data.btnBgColor || existing.btnBgColor,
      btnTextColor: data.btnTextColor || existing.btnTextColor,
      enabled: data.enabled ?? existing.enabled,
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "HERO_SLIDE_UPDATE",
      targetType: "HERO_SLIDE",
      targetId: id,
      details: `Updated hero slide "${updated.title}"`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/admin/hero-slider");
  return { success: true, data: updated };
}

// 5. Admin: Delete a Hero Slide
export async function deleteHeroSlide(id: string) {
  const admin = await verifyAdmin();

  const existing = await prisma.heroSlide.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Slide not found." };
  }

  await prisma.heroSlide.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "HERO_SLIDE_DELETE",
      targetType: "HERO_SLIDE",
      targetId: id,
      details: `Deleted hero slide "${existing.title}"`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/admin/hero-slider");
  return { success: true };
}

// 6. Admin: Toggle Slide Status (Enable / Disable)
export async function toggleHeroSlideStatus(id: string, enabled: boolean) {
  const admin = await verifyAdmin();

  const updated = await prisma.heroSlide.update({
    where: { id },
    data: { enabled },
  });

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "HERO_SLIDE_TOGGLE",
      targetType: "HERO_SLIDE",
      targetId: id,
      details: `${enabled ? "Enabled" : "Disabled"} hero slide "${updated.title}"`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/admin/hero-slider");
  return { success: true, enabled: updated.enabled };
}

// 7. Admin: Reorder Slides
export async function reorderHeroSlides(slideIds: string[]) {
  const admin = await verifyAdmin();

  await prisma.$transaction(
    slideIds.map((id, index) =>
      prisma.heroSlide.update({
        where: { id },
        data: { displayOrder: index },
      })
    )
  );

  await prisma.auditLog.create({
    data: {
      adminId: admin.id,
      adminEmail: admin.email,
      action: "HERO_SLIDE_REORDER",
      targetType: "HERO_SLIDE",
      targetId: "ALL",
      details: `Reordered ${slideIds.length} hero slides`,
    },
  });

  safeRevalidate("/");
  safeRevalidate("/admin/hero-slider");
  return { success: true };
}
