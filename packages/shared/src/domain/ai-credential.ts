import { createHash, randomBytes } from "node:crypto";

/**
 * AI client access keys (feature 004, research R2/R3). 256 random bits, stored only as a SHA-256 hash.
 * Server/CLI only: import from "@calci/shared/ai-credential", never from the web client bundle.
 */
const TOKEN_PATTERN = /^sfk_[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return `sfk_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The token from an `Authorization: Bearer sfk_...` header, or null when absent or malformed. */
/**
 * Feature 008: ChatGPT connectors can't send a header, so the same key may be given as the last path segment
 * (`/mcp/sfk_...`). Returns the key only if it has the key format.
 */
export function parsePathKey(segment: string | undefined): string | null {
  return segment && TOKEN_PATTERN.test(segment) ? segment : null;
}

export function parseBearer(header: string | undefined): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  const token = m?.[1];
  return token && TOKEN_PATTERN.test(token) ? token : null;
}
