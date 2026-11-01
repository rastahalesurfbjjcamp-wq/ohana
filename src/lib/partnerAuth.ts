// Login dos atletas e influenciadores no portal de parceiros (separado do login da equipe)
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";

const COOKIE = "rh_parceiro";
const key = () => new TextEncoder().encode(`parceiro:${env.sessionSecret()}`);

export async function partnerSignIn(pid: string) {
  const t = await new SignJWT({ pid }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(key());
  (await cookies()).set(COOKIE, t, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function partnerSignOut() {
  (await cookies()).delete(COOKIE);
}
export async function currentPartner() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    const p = await db.referral.findUnique({ where: { id: String(payload.pid) } });
    return p && p.active && p.passwordHash ? p : null;
  } catch {
    return null;
  }
}
