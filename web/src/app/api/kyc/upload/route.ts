import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
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
    const side = (formData.get("side") as string) || "document";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided for upload." },
        { status: 400 }
      );
    }

    // 3. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: `File size exceeds the 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB uploaded).`,
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
          error: "Invalid file extension. Please select a valid document.",
        },
        { status: 400 }
      );
    }

    // 6. Ensure secure private storage directory exists outside public
    const storageDir = path.join(process.cwd(), "storage", "kyc");
    await fs.promises.mkdir(storageDir, { recursive: true });

    // 7. Generate collision-free randomized filename tied to user
    const cleanSide = side === "front" ? "front" : side === "back" ? "back" : "doc";
    const uniqueId = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const safeFilename = `kyc_${user.id}_${cleanSide}_${Date.now()}_${uniqueId}${ext}`;
    const destinationPath = path.join(storageDir, safeFilename);

    // 8. Write file to private disk
    const arrayBuffer = await file.arrayBuffer();
    await fs.promises.writeFile(destinationPath, Buffer.from(arrayBuffer));

    // 9. Return secure access URL served via authorized endpoint
    const secureUrl = `/api/kyc/document/${safeFilename}`;

    return NextResponse.json({
      success: true,
      url: secureUrl,
      filename: safeFilename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      side: cleanSide,
    });
  } catch (err: any) {
    console.error("KYC upload error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to process document upload.",
      },
      { status: 500 }
    );
  }
}
