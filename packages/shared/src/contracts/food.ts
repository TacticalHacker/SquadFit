import { z } from "zod";
import { DateSchema } from "../domain/day";
import { FoodNameSchema, OwnFoodInputSchema, ServingLabelSchema } from "../domain/foods";
import { CaloriesSchema, MacrosSchema, MealSchema, ServingsSchema } from "../domain/nutrition";

export const FoodEntrySchema = z.object({
  entryId: z.string(),
  source: z.enum(["typed", "standard", "own"]),
  foodId: z.string().optional(),
  name: z.string(),
  serving: z.string().optional(),
  servings: z.number(),
  calories: z.number(),
  macros: MacrosSchema.nullable(),
  rate: z.object({ calories: z.number(), macros: MacrosSchema.nullable() }),
  meal: MealSchema,
});

export const FoodDayViewSchema = z.object({
  date: DateSchema,
  today: DateSchema,
  timezone: z.string(),
  editable: z.boolean(),
  meals: z.array(z.object({ meal: MealSchema, subtotal: z.number(), entries: z.array(FoodEntrySchema) })),
  ledger: z.object({
    eaten: z.number(),
    burned: z.number(),
    net: z.number(),
    target: z.number(),
    proteinTarget: z.number().nullable().default(null),
    remaining: z.number(),
    macros: z.object({
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
      entriesWithoutMacros: z.number(),
    }),
  }),
});

/** Macros on input may be partial; the server completes them (all-or-none, research R4). */
const PartialMacrosSchema = z.object({
  protein: MacrosSchema.shape.protein.optional(),
  carbs: MacrosSchema.shape.carbs.optional(),
  fat: MacrosSchema.shape.fat.optional(),
});

export const EntryCreateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("typed"),
    meal: MealSchema,
    name: FoodNameSchema,
    calories: CaloriesSchema,
    macros: PartialMacrosSchema.optional(),
  }),
  z.object({ kind: z.literal("standard"), meal: MealSchema, foodId: z.string(), servings: ServingsSchema }),
  z.object({ kind: z.literal("own"), meal: MealSchema, foodId: z.string(), servings: ServingsSchema }),
]);
export type EntryCreate = z.infer<typeof EntryCreateSchema>;

export const EntryPatchSchema = z.object({
  name: FoodNameSchema.optional(),
  calories: CaloriesSchema.optional(),
  macros: PartialMacrosSchema.nullable().optional(),
  meal: MealSchema.optional(),
  servings: ServingsSchema.optional(),
});
export type EntryPatch = z.infer<typeof EntryPatchSchema>;

export const RecentFoodsResponseSchema = z.object({
  foods: z.array(z.object({ name: z.string(), calories: z.number(), macros: MacrosSchema.nullable() })),
});
export type RecentFoodsResponse = z.infer<typeof RecentFoodsResponseSchema>;

export const OwnFoodSchema = z.object({
  foodId: z.string(),
  name: z.string(),
  serving: z.string(),
  calories: z.number(),
  macros: MacrosSchema.nullable(),
});
export const OwnFoodsResponseSchema = z.object({ foods: z.array(OwnFoodSchema) });
export const OwnFoodResponseSchema = z.object({ food: OwnFoodSchema });
export type OwnFood = z.infer<typeof OwnFoodSchema>;

export { OwnFoodInputSchema, ServingLabelSchema };
