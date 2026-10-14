import { NextResponse } from "next/server";
import { getTrackingConfig } from "@/actions/tracking";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = await getTrackingConfig();
    return NextResponse.json({
      success: true,
      metaPixel: {
        enabled: config.metaPixelEnabled,
        id: config.metaPixelId,
        hasCustomScript: Boolean(config.metaCustomScript),
      },
      gtm: {
        enabled: config.gtmEnabled,
        id: config.gtmId,
        hasCustomScript: Boolean(config.gtmCustomScript),
      },
      hasCustomHeadCode: Boolean(config.customHeadCode),
      hasCustomBodyCode: Boolean(config.customBodyCode),
      trackAdminPages: config.trackAdminPages,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: msg || "Failed to load tracking settings" },
      { status: 500 }
    );
  }
}
