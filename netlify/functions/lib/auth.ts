// Optional APP_PASSWORD gate (PRD §9.4). When APP_PASSWORD is set (non-blank), callers must send
// `x-app-password` with the same value. Comparison is constant-time over SHA-256 digests, so neither
// content nor length leaks through timing. Unset → open. /api/health is not gated.
import { createHash, timingSafeEqual } from "node:crypto";

export const PASSWORD_HEADER = "x-app-password";

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

export function configuredPassword(): string | undefined {
  const p = process.env.APP_PASSWORD?.trim();
  return p ? p : undefined;
}

export function passwordMatches(provided: string | null | undefined, expected: string): boolean {
  if (typeof provided !== "string" || provided.length === 0) return false;
  return timingSafeEqual(digest(provided.trim()), digest(expected));
}

/** true when the request may proceed (gate off, or correct password). */
export function isAuthorized(req: Request): boolean {
  const expected = configuredPassword();
  if (!expected) return true;
  return passwordMatches(req.headers.get(PASSWORD_HEADER), expected);
}
