import { z } from "zod";
import { UsernameSchema } from "../domain/username";
import { CATALOG_LIMIT, CatalogExerciseSchema, CatalogGroupSchema, ExerciseNameSchema, MuscleGroupSchema } from "../domain/gym";

/** Feature 015: `/admin/exercises` (admins only). See specs/015-exercise-admin-panel/contracts/api.md. */

export const AdminExerciseInputSchema = z.strictObject({ name: ExerciseNameSchema, group: CatalogGroupSchema });
export type AdminExerciseInput = z.infer<typeof AdminExerciseInputSchema>;

export const AdminExercisePatchSchema = z
  .strictObject({
    updatedAt: z.string().min(1),
    name: ExerciseNameSchema.optional(),
    group: CatalogGroupSchema.optional(),
    status: z.enum(["active", "retired"]).optional(),
  })
  .refine((p) => p.name !== undefined || p.group !== undefined || p.status !== undefined, "Nothing to change");
export type AdminExercisePatch = z.infer<typeof AdminExercisePatchSchema>;

export const AdminExerciseResponseSchema = z.strictObject({ exercise: CatalogExerciseSchema });
export type AdminExerciseResponse = z.infer<typeof AdminExerciseResponseSchema>;

export const AdminExercisesResponseSchema = z.strictObject({
  builtIn: z.array(z.strictObject({ exerciseId: z.string(), name: z.string(), group: MuscleGroupSchema, kind: z.enum(["strength", "cardio"]) })),
  catalog: z.array(CatalogExerciseSchema),
  /** Library exercise id → number of members with a same-name own exercise. Counts only (FR-017). */
  ownMatches: z.record(z.string(), z.number().int().nonnegative()),
  limit: z.literal(CATALOG_LIMIT),
});
export type AdminExercisesResponse = z.infer<typeof AdminExercisesResponseSchema>;

const count = z.number().int().nonnegative();
export const AdminMergeResponseSchema = z.strictObject({ members: count, moved: count, skipped: count, removed: count });
export type AdminMergeResponse = z.infer<typeof AdminMergeResponseSchema>;

/** Story 5: `POST /admin/users`. The temporary password is returned once and never stored (FR-022). */
export const AdminUserInputSchema = z.strictObject({ username: UsernameSchema });
export type AdminUserInput = z.infer<typeof AdminUserInputSchema>;
export const AdminUserCreatedSchema = z.strictObject({ username: z.string(), temporaryPassword: z.string().min(8) });
export type AdminUserCreated = z.infer<typeof AdminUserCreatedSchema>;
