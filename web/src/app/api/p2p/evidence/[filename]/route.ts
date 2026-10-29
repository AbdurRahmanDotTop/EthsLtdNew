import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getP2pEvidenceFromD1 } from "@/lib/p2p-evidence-storage";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in to view dispute evidence." },
        { status: 401 }
      );
    }

    const { filename } = await params;
    if (!filename) {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 });
    }

    const safeFilename = path.basename(filename);
    const isAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";

    if (!isAdmin) {
      const userPrefix = `p2p_ev_${currentUser.id}_`;
      const isUploader = safeFilename.startsWith(userPrefix);

      let isPartyInDispute = false;
      if (!isUploader) {
        // Check if user is buyer or seller of any dispute containing this filename
        const matchingDispute = await prisma.p2pDispute.findFirst({
          where: {
            evidenceUrls: { contains: safeFilename },
            order: {
              OR: [
                { buyerId: currentUser.id },
                { sellerId: currentUser.id },
              ],
            },
          },
        });
        isPartyInDispute = Boolean(matchingDispute);
      }

      if (!isUploader && !isPartyInDispute) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to view this dispute evidence." },
          { status: 403 }
        );
      }
    }

    const doc = await getP2pEvidenceFromD1(safeFilename);
    if (!doc || !doc.buffer) {
      return NextResponse.json(
        { error: "Evidence file not found in persistent storage." },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(doc.buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Length": doc.buffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("Failed to serve P2P evidence document:", error);
    return NextResponse.json(
      { error: "Internal server error retrieving evidence document." },
      { status: 500 }
    );
  }
}
