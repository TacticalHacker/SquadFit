import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { apiError } from "./http";

export interface Caller {
  userId: string;
  username: string;
  /** Feature 015: member of the Cognito group `admin`. */
  isAdmin: boolean;
}

/**
 * The `cognito:groups` claim: the HTTP API JWT authorizer passes arrays as a string like "[admin other]";
 * a real array is accepted too (research R1).
 */
export function isAdminClaim(value: unknown): boolean {
  if (Array.isArray(value)) return value.includes("admin");
  if (typeof value !== "string") return false;
  return value.replace(/^\[|\]$/g, "").split(/[\s,]+/).includes("admin");
}

/** Identity comes from the verified Cognito access token (API Gateway JWT authorizer). */
export function getCaller(event: APIGatewayProxyEventV2WithJWTAuthorizer): Caller {
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const userId = claims.sub;
  const username = claims.username;
  if (typeof userId !== "string" || typeof username !== "string") {
    throw new Error("Missing sub/username claims; is the JWT authorizer attached to this route?");
  }
  return { userId, username, isAdmin: isAdminClaim(claims["cognito:groups"]) };
}

/** 403 for anyone outside the admin group, else null. Every `/admin/*` handler starts with this. */
export function requireAdmin(caller: Caller): APIGatewayProxyResultV2 | null {
  return caller.isAdmin ? null : apiError(403, "FORBIDDEN", "Admins only");
}
