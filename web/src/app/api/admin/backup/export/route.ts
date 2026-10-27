import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  generateFullDatabaseExport,
  generateWebsiteConfigExport,
  generateMediaArchiveExport,
  generateProjectSourceExport,
} from "@/lib/backup-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized: Super Admin privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "full_db";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (type === "project_source") {
      const zipBuffer = await generateProjectSourceExport();

      await prisma.auditLog.create({
        data: {
          adminId: session.userId,
          adminEmail: session.email,
          action: "BACKUP_DOWNLOAD",
          targetType: "PROJECT_SOURCE",
          targetId: "source_bundle",
          details: `Super Admin downloaded clean project source bundle (size: ${(zipBuffer.length / 1024).toFixed(1)} KB).`,
        },
      });

      return new NextResponse(zipBuffer as any, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="ethsltd_source_bundle_${timestamp}.zip"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    let backupData: any = null;
    let filename = `ethsltd_backup_${type}_${timestamp}.json`;

    if (type === "full_db") {
      backupData = await generateFullDatabaseExport(session.email);
      filename = `ethsltd_full_database_${timestamp}.json`;
    } else if (type === "website_config") {
      backupData = await generateWebsiteConfigExport(session.email);
      filename = `ethsltd_website_config_${timestamp}.json`;
    } else if (type === "media") {
      backupData = await generateMediaArchiveExport(session.email);
      filename = `ethsltd_media_archive_${timestamp}.json`;
    } else {
      return NextResponse.json({ error: `Unknown backup type: ${type}` }, { status: 400 });
    }

    await prisma.auditLog.create({
      data: {
        adminId: session.userId,
        adminEmail: session.email,
        action: "BACKUP_DOWNLOAD",
        targetType: backupData.manifest.type,
        targetId: filename,
        details: `Super Admin exported ${backupData.manifest.type} (${backupData.manifest.totalRecords} records, checksum: ${backupData.manifest.checksum.substring(0, 10)}...).`,
      },
    });

    const jsonString = JSON.stringify(backupData, null, 2);

    return new NextResponse(jsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("Backup export API error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate backup export" },
      { status: 500 }
    );
  }
}
