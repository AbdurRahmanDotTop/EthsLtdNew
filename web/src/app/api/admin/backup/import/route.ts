import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  validateBackupPackage,
  restoreFullDatabase,
  restoreWebsiteConfiguration,
  restoreMediaArchive,
} from "@/lib/backup-service";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin privileges required." },
        { status: 403 }
      );
    }

    let body: any;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const action = (formData.get("action") as string) || "validate";

      if (!file) {
        return NextResponse.json({ error: "No backup file uploaded." }, { status: 400 });
      }

      const text = await file.text();
      try {
        body = {
          package: JSON.parse(text),
          action,
        };
      } catch {
        return NextResponse.json(
          { error: "Uploaded file is not a valid JSON backup package." },
          { status: 400 }
        );
      }
    } else {
      body = await req.json();
    }

    const { action = "validate", package: pkg } = body;

    if (!pkg) {
      return NextResponse.json({ error: "Missing backup package in request." }, { status: 400 });
    }

    // 1. Validation phase
    const validation = validateBackupPackage(pkg);

    if (action === "validate") {
      return NextResponse.json({
        success: true,
        validation,
      });
    }

    // 2. Restoration phase
    if (action === "restore") {
      if (!validation.valid) {
        return NextResponse.json(
          {
            success: false,
            error: "Backup package failed integrity or schema validation.",
            details: validation.errors,
          },
          { status: 400 }
        );
      }

      const admin = { id: session.userId, email: session.email };
      const type = pkg.manifest?.type;

      let result: any;
      if (type === "FULL_DATABASE") {
        result = await restoreFullDatabase(pkg.data, admin);
      } else if (type === "WEBSITE_CONFIG") {
        result = await restoreWebsiteConfiguration(pkg.data, admin);
      } else if (type === "MEDIA_ARCHIVE") {
        result = await restoreMediaArchive(pkg.data, admin);
      } else {
        return NextResponse.json(
          { error: `Unsupported backup package type: ${type}` },
          { status: 400 }
        );
      }

      if (result.success) {
        try {
          revalidatePath("/admin");
          revalidatePath("/admin/users");
          revalidatePath("/admin/markets");
          revalidatePath("/admin/hero-slider");
          revalidatePath("/admin/p2p/channels");
        } catch {}
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error("Backup import API error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to process backup package" },
      { status: 500 }
    );
  }
}
