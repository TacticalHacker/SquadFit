import { z } from "zod";
import { CaloriesSchema, MacrosSchema, type Macros } from "./nutrition";

export interface StandardFood {
  id: string;
  name: string;
  serving: string;
  calories: number;
  macros: Macros;
}

const f = (id: string, name: string, serving: string, calories: number, protein: number, carbs: number, fat: number): StandardFood => ({
  id: `sf-${id}`, name, serving, calories, macros: { protein, carbs, fat },
});

/** Built-in foods (research R1): rough estimates for a typical serving. Ids are never reused. */
export const STANDARD_FOODS: readonly StandardFood[] = [
  f("roti", "Roti / chapati", "1 medium", 100, 3, 18, 2),
  f("paratha", "Plain paratha", "1 medium", 200, 4, 28, 8),
  f("rice", "Steamed rice", "1 cup", 200, 4, 45, 0.5),
  f("dal", "Dal", "1 cup", 180, 10, 27, 4),
  f("rajma", "Rajma curry", "1 cup", 220, 11, 30, 6),
  f("chole", "Chole (chickpea curry)", "1 cup", 270, 12, 36, 9),
  f("paneer-curry", "Paneer curry", "1 cup", 350, 14, 10, 28),
  f("chicken-curry", "Chicken curry", "1 cup", 300, 28, 8, 17),
  f("biryani", "Chicken biryani", "1 plate", 450, 25, 55, 14),
  f("idli", "Idli", "2 pieces", 120, 4, 25, 0.5),
  f("dosa", "Plain dosa", "1 medium", 170, 4, 30, 4),
  f("masala-dosa", "Masala dosa", "1 piece", 300, 6, 45, 10),
  f("poha", "Poha", "1 cup", 250, 5, 42, 7),
  f("upma", "Upma", "1 cup", 230, 5, 34, 8),
  f("samosa", "Samosa", "1 piece", 260, 4, 28, 15),
  f("sambar", "Sambar", "1 cup", 130, 6, 18, 4),
  f("curd", "Curd (dahi)", "1 cup", 120, 7, 9, 6),
  f("lassi", "Sweet lassi", "1 glass", 200, 6, 32, 5),
  f("gulab-jamun", "Gulab jamun", "1 piece", 150, 2, 22, 6),
  f("chai", "Chai with milk and sugar", "1 cup", 90, 2, 14, 3),
  f("coffee-milk", "Coffee with milk", "1 cup", 50, 2, 5, 2),
  f("egg-boiled", "Boiled egg", "1 large", 70, 6, 0.5, 5),
  f("omelette", "Omelette", "2 eggs", 190, 12, 1, 15),
  f("oats", "Oats with milk", "1 bowl", 250, 10, 38, 6),
  f("bread", "Bread", "1 slice", 80, 3, 15, 1),
  f("peanut-butter", "Peanut butter", "1 tbsp", 95, 3.5, 3, 7.5),
  f("sandwich", "Veg sandwich", "1 sandwich", 250, 8, 38, 8),
  f("banana", "Banana", "1 medium", 105, 1.2, 24, 0.4),
  f("apple", "Apple", "1 medium", 95, 0.5, 23, 0.3),
  f("almonds", "Almonds", "10 pieces", 70, 2.5, 2.5, 5.5),
  f("milk", "Whole milk", "1 cup", 150, 8, 12, 8),
  f("chicken-breast", "Grilled chicken breast", "100 g", 165, 31, 0, 4),
  f("fish-grilled", "Grilled fish", "100 g", 130, 22, 0, 4),
  f("salad", "Mixed salad with dressing", "1 bowl", 120, 2, 10, 8),
  f("pasta", "Pasta with tomato sauce", "1 cup", 250, 8, 45, 4),
  f("pizza", "Pizza", "1 slice", 285, 12, 36, 10),
  f("burger", "Cheeseburger", "1 burger", 400, 20, 35, 20),
  f("fries", "French fries", "1 medium", 365, 4, 48, 17),
  f("protein-shake", "Protein shake", "1 scoop in water", 120, 24, 3, 1.5),
  f("soft-drink", "Soft drink", "1 can", 140, 0, 35, 0),
];

export const findStandardFood = (id: string) => STANDARD_FOODS.find((x) => x.id === id);

export const normalizeFoodName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

export const FoodNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Name is required").max(60, "Name must be at most 60 characters"));

export const ServingLabelSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Serving is required").max(40, "Serving must be at most 40 characters"));

export const OwnFoodInputSchema = z.object({
  name: FoodNameSchema,
  serving: ServingLabelSchema,
  calories: CaloriesSchema,
  macros: MacrosSchema.optional(),
});
export type OwnFoodInput = z.infer<typeof OwnFoodInputSchema>;

/** True if another of the user's own foods already has this name (FR-021). Built-in names are allowed. */
export function isOwnFoodNameTaken(name: string, existingOwnNames: readonly string[]): boolean {
  const n = normalizeFoodName(name);
  return existingOwnNames.some((e) => normalizeFoodName(e) === n);
}
