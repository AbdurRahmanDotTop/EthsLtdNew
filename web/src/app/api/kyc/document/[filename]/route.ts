import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import path from "path";
import fs from "fs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // 1. Authenticate user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to view documents." },
        { status: 401 }
      );
    }

    const { filename } = await params;
    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    // 2. Strict path traversal protection: enforce basename only
    const safeFilename = path.basename(filename);
    const storageDir = path.join(process.cwd(), "storage", "kyc");
    const filePath = path.join(storageDir, safeFilename);

    // 3. Authorization check
    const isAdmin =
      currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";

    if (!isAdmin) {
      // Check if file belongs to this user by prefix
      const userPrefix = `kyc_${currentUser.id}_`;
      const isOwnerByPrefix = safeFilename.startsWith(userPrefix);

      let isOwnerByDb = false;
      if (!isOwnerByPrefix) {
        const matchingKyc = await prisma.kycApplication.findFirst({
          where: {
            userId: currentUser.id,
            OR: [
              { idFrontUrl: { contains: safeFilename } },
              { idBackUrl: { contains: safeFilename } },
            ],
          },
        });
        isOwnerByDb = !!matchingKyc;
      }

      if (!isOwnerByPrefix && !isOwnerByDb) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to view this document." },
          { status: 403 }
        );
      }
    }

    // 4. Verify file exists on private disk
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // 5. Read file and determine correct MIME type
    const fileBuffer = await fs.promises.readFile(filePath);
    const ext = path.extname(safeFilename).toLowerCase();

    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    // 6. Return response with strict private caching headers
    const isDownload = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${safeFilename}"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err: any) {
    console.error("KYC document retrieval error:", err);
    return NextResponse.json(
      { error: "Internal server error reading document." },
      { status: 500 }
    );
  }
}
