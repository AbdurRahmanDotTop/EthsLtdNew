import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import prisma from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "ethsltd_super_secret_jwt_key_2026_production"
);

const COOKIE_NAME = "ethsltd_auth_token";

export interface SessionPayload {
  userId: string;
  email: string;
  role: string;
  uid: number;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;

  // Cloudflare D1 P2P system compatibility: 64-hex char SHA-256 hash
  if (hash.length === 64 && /^[0-9a-fA-F]{64}$/.test(hash)) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const shaBuffer = await crypto.subtle.digest("SHA-256", data);
      const shaHex = Array.from(new Uint8Array(shaBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (shaHex.toLowerCase() === hash.toLowerCase()) {
        return true;
      }
    } catch {
      // fallback to bcrypt
    }
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(payload: SessionPayload) {
  try {
    const token = await signToken(payload);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  } catch {
    // Outside Next.js request context (e.g., CLI test script)
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { wallets: true, kyc: true, bankCards: true, cryptoWallets: true } as any,
  });

  return user;
}

export async function clearAuthCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {
    // Outside Next.js request context
  }
}
