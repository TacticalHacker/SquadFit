/**
 * Contracts and pure domain logic shared by apps/web, services/api and infra.
 *
 * Request/response shapes live here as zod schemas so the frontend and the
 * Lambda handlers validate against the same source of truth.
 */
export * from "./contracts/health";
export * from "./contracts/errors";
export * from "./contracts/me";
export * from "./contracts/people";
export * from "./domain/username";
export * from "./domain/profile";
export * from "./domain/timezone";
