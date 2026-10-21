import { getCloudflareContext } from "@opennextjs/cloudflare";
import prisma from "@/lib/prisma";
import path from "path";
import fs from "fs";

const CHUNK_SIZE = 60000; // ~60KB per chunk of base64 text (strictly under D1 100KB SQLITE_TOOBIG limit)

function getDbBinding(): any {
  try {
    const cf = getCloudflareContext({ async: false });
    if ((cf as any)?.env?.DB) return (cf as any).env.DB;
  } catch {}

  const cfGlobal = (globalThis as any)[Symbol.for("__cloudflare-context__")];
  if (cfGlobal?.env?.DB) return cfGlobal.env.DB;

  return (globalThis as any).DB || null;
}

export async function saveDepositProofToD1({
  filename,
  userId,
  mimeType,
  buffer,
}: {
  filename: string;
  userId: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<void> {
  const base64 = buffer.toString("base64");
  const fileSize = buffer.length;
  const now = Math.floor(Date.now() / 1000);

  // Split base64 into safe chunks
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_SIZE));
  }
  const totalChunks = chunks.length;

  const dbBinding = getDbBinding();

  if (dbBinding) {
    // Use Cloudflare D1 batch API for transactional atomic insert
    const statements = chunks.map((chunk, index) => {
      const id = `${filename}_chunk_${index}`;
      return dbBinding
        .prepare(
          `INSERT OR REPLACE INTO kyc_documents 
          (id, filename, user_id, side, mime_type, file_size, chunk_index, total_chunks, data, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          filename,
          userId,
          "deposit_proof",
          mimeType,
          fileSize,
          index,
          totalChunks,
          chunk,
          now
        );
    });
    await dbBinding.batch(statements);
  } else {
    // Fallback via Prisma raw SQL (for local development or Node scripts)
    for (let index = 0; index < chunks.length; index++) {
      const id = `${filename}_chunk_${index}`;
      const chunk = chunks[index];
      await prisma.$executeRawUnsafe(
        `INSERT OR REPLACE INTO kyc_documents 
        (id, filename, user_id, side, mime_type, file_size, chunk_index, total_chunks, data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        id,
        filename,
        userId,
        "deposit_proof",
        mimeType,
        fileSize,
        index,
        totalChunks,
        chunk,
        now
      );
    }
  }

  // Safe dev fallback: write to local disk if running locally and writable
  try {
    const storageDir = path.join(process.cwd(), "storage", "deposits");
    if (!fs.existsSync(storageDir)) {
      await fs.promises.mkdir(storageDir, { recursive: true });
    }
    await fs.promises.writeFile(path.join(storageDir, filename), buffer);
  } catch {
    // Silently ignore disk write errors on Cloudflare Workers (read-only filesystem)
  }
}

export async function getDepositProofFromD1(
  filename: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const dbBinding = getDbBinding();

  let rows: any[] = [];
  if (dbBinding) {
    const result = await dbBinding
      .prepare(
        `SELECT chunk_index, total_chunks, data, mime_type 
         FROM kyc_documents 
         WHERE filename = ? 
         ORDER BY chunk_index ASC`
      )
      .bind(filename)
      .all();
    rows = result.results || [];
  } else {
    try {
      rows = (await prisma.$queryRawUnsafe(
        `SELECT chunk_index, total_chunks, data, mime_type 
         FROM kyc_documents 
         WHERE filename = $1 
         ORDER BY chunk_index ASC`,
        filename
      )) as any[];
    } catch (e) {
      console.warn("Prisma raw query for deposit proof fallback failed:", e);
    }
  }

  if (rows && rows.length > 0) {
    const mimeType = rows[0].mime_type || "application/octet-stream";
    const fullBase64 = rows.map((r: any) => r.data).join("");
    const buffer = Buffer.from(fullBase64, "base64");
    return { buffer, mimeType };
  }

  // Fallback to local disk (for any legacy files uploaded locally)
  try {
    const filePath = path.join(process.cwd(), "storage", "deposits", filename);
    if (fs.existsSync(filePath)) {
      const buffer = await fs.promises.readFile(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
      };
      return { buffer, mimeType: mimeMap[ext] || "application/octet-stream" };
    }
  } catch {
    // Ignore disk read errors
  }

  return null;
}
