import crypto from "crypto";
import bcrypt from "bcryptjs";
import { q } from "./db";

export type UserRole = "admin" | "manager" | "user";

export interface DbUser {
  id: string;
  ecosystem_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  department: string | null;
  phone: string | null;
  invite_code: string | null;
  is_active: boolean;
  email_verified: boolean;
  email_verification_token: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  ecosystemId: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string | null;
  phone?: string | null;
  inviteCode?: string | null;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TOKEN_TTL_DAYS = 7;

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);

export function sanitizeUser(row: DbUser): PublicUser {
  return {
    id: row.id,
    ecosystemId: row.ecosystem_id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    phone: row.phone,
    inviteCode: row.invite_code,
    isActive: row.is_active,
    emailVerified: row.email_verified ?? false,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const bearerFromRequest = (req: Request): string | null => {
  const auth = req.headers.get("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();

  const cookie = req.headers.get("cookie");
  if (cookie) {
    const match = cookie.split(";").find((c) => c.trim().startsWith("token="));
    if (match) return match.split("=")[1];
  }
  return null;
};

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const { rows } = await q("SELECT * FROM users WHERE email = $1", [
    email.toLowerCase(),
  ]);
  return (rows[0] as DbUser | undefined) ?? null;
}

export async function getUserByToken(
  token: string,
): Promise<{ user: DbUser; token: string } | null> {
  const { rows } = await q(
    `SELECT u.* 
     FROM sessions s 
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW() AND u.is_active = TRUE`,
    [token],
  );
  const user = rows[0] as DbUser | undefined;
  if (!user) return null;
  return { user, token };
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await q(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [token, userId, expiresAt],
  );
  return { token, expiresAt };
}

export async function revokeSession(token: string) {
  await q("DELETE FROM sessions WHERE token = $1", [token]);
}

export async function touchLastLogin(userId: string) {
  await q("UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1", [
    userId,
  ]);
}

export async function requireAuth(
  req: Request,
): Promise<{ user: PublicUser; token: string } | null> {
  const token = bearerFromRequest(req);
  if (!token) return null;
  const session = await getUserByToken(token);
  if (!session) return null;
  return { user: sanitizeUser(session.user), token };
}
