"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  TrackingConfigData,
  TrackingConfigInput,
  DEFAULT_TRACKING_CONFIG,
} from "@/lib/tracking";

export type { TrackingConfigData, TrackingConfigInput };

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

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Non-Next.js or background context
  }
}

// High-performance edge in-memory cache to prevent D1 hits on every SSR page load
let cachedTrackingConfig: TrackingConfigData | null = null;
let lastTrackingFetch = 0;
const TRACKING_CACHE_TTL = 60000; // 60 seconds

export async function invalidateTrackingCache() {
  cachedTrackingConfig = null;
  lastTrackingFetch = 0;
}

/**
 * 1. Public query for frontend tracking injection
 * Cached in-memory to ensure zero latency and zero D1 load during SSR.
 */
export async function getTrackingConfig(): Promise<TrackingConfigData> {
  const now = Date.now();
  if (cachedTrackingConfig && now - lastTrackingFetch < TRACKING_CACHE_TTL) {
    return cachedTrackingConfig;
  }

  try {
    const existing = await prisma.trackingConfig.findUnique({
      where: { id: "default" },
    });

    if (existing) {
      cachedTrackingConfig = {
        id: existing.id,
        metaPixelEnabled: Boolean(existing.metaPixelEnabled),
        metaPixelId: existing.metaPixelId ?? DEFAULT_TRACKING_CONFIG.metaPixelId,
        metaCustomScript: existing.metaCustomScript ?? null,
        gtmEnabled: Boolean(existing.gtmEnabled),
        gtmId: existing.gtmId ?? DEFAULT_TRACKING_CONFIG.gtmId,
        gtmCustomScript: existing.gtmCustomScript ?? null,
        customHeadCode: existing.customHeadCode ?? null,
        customBodyCode: existing.customBodyCode ?? null,
        trackAdminPages: Boolean(existing.trackAdminPages),
      };
      lastTrackingFetch = now;
      return cachedTrackingConfig;
    }

    // Auto-seed default configuration
    const created = await prisma.trackingConfig.create({
      data: {
        id: "default",
        metaPixelEnabled: DEFAULT_TRACKING_CONFIG.metaPixelEnabled,
        metaPixelId: DEFAULT_TRACKING_CONFIG.metaPixelId,
        metaCustomScript: null,
        gtmEnabled: DEFAULT_TRACKING_CONFIG.gtmEnabled,
        gtmId: DEFAULT_TRACKING_CONFIG.gtmId,
        gtmCustomScript: null,
        customHeadCode: null,
        customBodyCode: null,
        trackAdminPages: DEFAULT_TRACKING_CONFIG.trackAdminPages,
      },
    });

    cachedTrackingConfig = {
      id: created.id,
      metaPixelEnabled: Boolean(created.metaPixelEnabled),
      metaPixelId: created.metaPixelId ?? DEFAULT_TRACKING_CONFIG.metaPixelId,
      metaCustomScript: created.metaCustomScript ?? null,
      gtmEnabled: Boolean(created.gtmEnabled),
      gtmId: created.gtmId ?? DEFAULT_TRACKING_CONFIG.gtmId,
      gtmCustomScript: created.gtmCustomScript ?? null,
      customHeadCode: created.customHeadCode ?? null,
      customBodyCode: created.customBodyCode ?? null,
      trackAdminPages: Boolean(created.trackAdminPages),
    };
    lastTrackingFetch = now;
    return cachedTrackingConfig;
  } catch (err) {
    console.warn("getTrackingConfig fallback to defaults:", err);
    return DEFAULT_TRACKING_CONFIG;
  }
}

/**
 * 2. Admin Query: Retrieve tracking configuration for settings page
 */
export async function getTrackingConfigAdmin() {
  await verifyAdmin();
  return getTrackingConfig();
}

/**
 * 3. Admin Mutation: Save/Update Tracking & Pixel settings
 */
export async function saveTrackingConfig(input: TrackingConfigInput) {
  const admin = await verifyAdmin();

  const cleanMetaPixelId = input.metaPixelId ? input.metaPixelId.trim() : null;
  const cleanGtmId = input.gtmId ? input.gtmId.trim().toUpperCase() : null;

  try {
    const updated = await prisma.trackingConfig.upsert({
      where: { id: "default" },
      update: {
        metaPixelEnabled: input.metaPixelEnabled,
        metaPixelId: cleanMetaPixelId,
        metaCustomScript: input.metaCustomScript?.trim() || null,
        gtmEnabled: input.gtmEnabled,
        gtmId: cleanGtmId,
        gtmCustomScript: input.gtmCustomScript?.trim() || null,
        customHeadCode: input.customHeadCode?.trim() || null,
        customBodyCode: input.customBodyCode?.trim() || null,
        trackAdminPages: input.trackAdminPages,
      },
      create: {
        id: "default",
        metaPixelEnabled: input.metaPixelEnabled,
        metaPixelId: cleanMetaPixelId || DEFAULT_TRACKING_CONFIG.metaPixelId,
        metaCustomScript: input.metaCustomScript?.trim() || null,
        gtmEnabled: input.gtmEnabled,
        gtmId: cleanGtmId || DEFAULT_TRACKING_CONFIG.gtmId,
        gtmCustomScript: input.gtmCustomScript?.trim() || null,
        customHeadCode: input.customHeadCode?.trim() || null,
        customBodyCode: input.customBodyCode?.trim() || null,
        trackAdminPages: input.trackAdminPages,
      },
    });

    // Record audit log
    try {
      await prisma.auditLog.create({
        data: {
          adminId: admin.id,
          adminEmail: admin.email,
          action: "TRACKING_SETTINGS_UPDATED",
          targetType: "PLATFORM_SETTINGS",
          targetId: "default",
          details: JSON.stringify({
            metaPixelEnabled: input.metaPixelEnabled,
            metaPixelId: cleanMetaPixelId,
            gtmEnabled: input.gtmEnabled,
            gtmId: cleanGtmId,
            trackAdminPages: input.trackAdminPages,
          }),
        },
      });
    } catch (auditErr) {
      console.warn("Audit log creation failed for tracking update:", auditErr);
    }

    invalidateTrackingCache();
    safeRevalidate("/");
    safeRevalidate("/admin/tracking");

    return { success: true, config: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("saveTrackingConfig error:", err);
    return { success: false, error: msg || "Failed to update tracking configuration." };
  }
}

/**
 * 4. Admin Mutation: Reset tracking configuration to defaults
 */
export async function resetTrackingConfig() {
  const admin = await verifyAdmin();

  try {
    const reset = await prisma.trackingConfig.upsert({
      where: { id: "default" },
      update: {
        metaPixelEnabled: DEFAULT_TRACKING_CONFIG.metaPixelEnabled,
        metaPixelId: DEFAULT_TRACKING_CONFIG.metaPixelId,
        metaCustomScript: null,
        gtmEnabled: DEFAULT_TRACKING_CONFIG.gtmEnabled,
        gtmId: DEFAULT_TRACKING_CONFIG.gtmId,
        gtmCustomScript: null,
        customHeadCode: null,
        customBodyCode: null,
        trackAdminPages: DEFAULT_TRACKING_CONFIG.trackAdminPages,
      },
      create: {
        id: "default",
        metaPixelEnabled: DEFAULT_TRACKING_CONFIG.metaPixelEnabled,
        metaPixelId: DEFAULT_TRACKING_CONFIG.metaPixelId,
        metaCustomScript: null,
        gtmEnabled: DEFAULT_TRACKING_CONFIG.gtmEnabled,
        gtmId: DEFAULT_TRACKING_CONFIG.gtmId,
        gtmCustomScript: null,
        customHeadCode: null,
        customBodyCode: null,
        trackAdminPages: DEFAULT_TRACKING_CONFIG.trackAdminPages,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          adminId: admin.id,
          adminEmail: admin.email,
          action: "TRACKING_SETTINGS_RESET",
          targetType: "PLATFORM_SETTINGS",
          targetId: "default",
          details: "Reset tracking configuration to default Meta Pixel & GTM parameters.",
        },
      });
    } catch (auditErr) {
      console.warn("Audit log creation failed for tracking reset:", auditErr);
    }

    invalidateTrackingCache();
    safeRevalidate("/");
    safeRevalidate("/admin/tracking");

    return { success: true, config: reset };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg || "Failed to reset tracking configuration." };
  }
}
