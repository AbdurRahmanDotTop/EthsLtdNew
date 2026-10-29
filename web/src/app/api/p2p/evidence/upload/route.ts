import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { saveP2pEvidenceToD1 } from "@/lib/p2p-evidence-storage";
import path from "path";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "application/pdf",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orderId = formData.get("orderId") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No evidence file provided for upload." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller file.`,
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file format. Allowed formats: JPG, PNG, WEBP, or PDF.",
        },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file extension. Please select a valid document or image.",
        },
        { status: 400 }
      );
    }

    // Optional order authorization check
    if (orderId) {
      const order = await prisma.p2pOrder.findUnique({
        where: { id: orderId },
        select: { buyerId: true, sellerId: true },
      });
      const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
      if (order && !isAdmin && order.buyerId !== user.id && order.sellerId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You are not a counterparty on this order." },
          { status: 403 }
        );
      }
    }

    const uniqueId = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const safeFilename = `p2p_ev_${user.id}_${Date.now()}_${uniqueId}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await saveP2pEvidenceToD1({
      filename: safeFilename,
      userId: user.id,
      mimeType: file.type,
      buffer,
    });

    const secureUrl = `/api/p2p/evidence/${safeFilename}`;

    return NextResponse.json({
      success: true,
      url: secureUrl,
      filename: safeFilename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
    });
  } catch (error: any) {
    console.error("P2P evidence upload failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to upload evidence file.",
      },
      { status: 500 }
    );
  }
}

