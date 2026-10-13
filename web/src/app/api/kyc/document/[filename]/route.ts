import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getKycDocumentFromD1 } from "@/lib/kyc-storage";
import path from "path";

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

    // 4. Retrieve document from D1 persistent storage (or disk fallback)
    const doc = await getKycDocumentFromD1(safeFilename);
    if (!doc) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    // 5. Return response with strict private caching headers
    const isDownload = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(doc.buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
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
