import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveDepositProofToD1 } from "@/lib/deposit-storage";
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
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    // 2. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No payment proof file provided for upload." },
        { status: 400 }
      );
    }

    // 3. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB uploaded). Please choose a smaller file.`,
        },
        { status: 400 }
      );
    }

    // 4. Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file format. Allowed formats: JPG, PNG, WEBP, or PDF.",
        },
        { status: 400 }
      );
    }

    // 5. Validate file extension
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

    // 6. Generate collision-free randomized filename tied to authenticated user
    const uniqueId = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const safeFilename = `proof_${user.id}_${Date.now()}_${uniqueId}${ext}`;

    // 7. Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 8. Save file to persistent storage (Cloudflare D1 with local fallback)
    await saveDepositProofToD1({
      filename: safeFilename,
      userId: user.id,
      mimeType: file.type,
      buffer,
    });

    // 9. Return secure access URL served via authorized endpoint
    const secureUrl = `/api/deposit/proof/${safeFilename}`;

    return NextResponse.json({
      success: true,
      url: secureUrl,
      filename: safeFilename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
    });
  } catch (err: any) {
    console.error("Deposit proof upload error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to process payment proof upload.",
      },
      { status: 500 }
    );
  }
}
