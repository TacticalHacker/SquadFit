import { z } from "zod";

/** 3–20 characters: letters, digits, underscore (FR-002). Uniqueness is enforced by the identity provider. */
export const UsernameSchema = z
  .string()
  .regex(/^[A-Za-z0-9_]{3,20}$/, "Username must be 3–20 letters, digits or underscores");

export type Username = z.infer<typeof UsernameSchema>;
