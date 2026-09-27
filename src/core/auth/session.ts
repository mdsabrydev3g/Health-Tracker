import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * Single-account auth for a family app: one caregiver account defined by
 * environment variables (email + PBKDF2 password hash). Sessions are signed
 * JWTs in an httpOnly cookie.
 */

export const SESSION_COOKIE = "ht_session";
const ITERATIONS = 100_000;

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(s);
}

/** PBKDF2 hash: "iterations:saltHex:hashHex" */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256").toString("hex");
  return `${ITERATIONS}:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [iters, salt, expected] = stored.trim().split(":");
    if (!iters || !salt || !expected) return false;
    const hash = crypto
      .pbkdf2Sync(password, salt, parseInt(iters, 10), 32, "sha256")
      .toString("hex");
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false; // malformed stored hash — treat as invalid, never crash
  }
}

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ sub: email, role: "caregiver" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "caregiver" || typeof payload.sub !== "string") return null;
    return { email: payload.sub };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ email: string } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function checkCredentials(email: string, password: string): boolean {
  const okEmail =
    process.env.CAREGIVER_EMAIL &&
    email.trim().toLowerCase() === process.env.CAREGIVER_EMAIL.trim().toLowerCase();
  const okPass =
    process.env.CAREGIVER_PASSWORD_HASH &&
    verifyPassword(password, process.env.CAREGIVER_PASSWORD_HASH);
  return Boolean(okEmail && okPass);
}
