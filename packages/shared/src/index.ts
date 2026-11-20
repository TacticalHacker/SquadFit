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
export * from "./domain/calories";
export * from "./domain/day";
export * from "./domain/log-id";
export * from "./domain/workouts";
export * from "./domain/day-view";
export * from "./contracts/workouts";
export * from "./domain/gym";
export * from "./domain/gym-drawer";
export * from "./contracts/gym";
export * from "./contracts/admin-exercises";
export * from "./domain/streak";
export * from "./domain/nutrition";
export * from "./domain/foods";
export * from "./domain/food-day";
export * from "./domain/recent-foods";
export * from "./domain/photo-entry";
export * from "./contracts/food";
export * from "./domain/coach-note";
export * from "./contracts/coach";
export * from "./contracts/public";
export * from "./domain/week";
export * from "./domain/squad";
export * from "./domain/boards";
export * from "./contracts/squad";
export * from "./domain/member-profile";
export * from "./domain/nutrition-share";
export * from "./contracts/squad-profile";
export * from "./contracts/squad-boards";
export * from "./domain/activity";
export * from "./contracts/activity";
