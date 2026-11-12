import { handle as getGym } from "../src/handlers/gym-get";
import { handle as putEntry } from "../src/handlers/gym-entry-put";
import { handle as deleteEntry } from "../src/handlers/gym-entry-delete";
import { makeEvent, parse } from "./fakes";

type D = Parameters<typeof getGym>[1];

export const sets = (n: number, weightKg: number, reps: number, completed = false) =>
  Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, weightKg, reps, completed }));

export const gymGet = (deps: D, date?: string, sub = "user-1") =>
  getGym(makeEvent({ sub, ...(date ? { queryStringParameters: { date } } : {}) }), deps).then(parse);

export const gymPut = (deps: D, date: string, exerciseId: string, body: unknown, sub = "user-1") =>
  putEntry(makeEvent({ sub, pathParameters: { date, exerciseId }, body }), deps).then(parse);

export const gymDelete = (deps: D, date: string, exerciseId: string, sub = "user-1") =>
  deleteEntry(makeEvent({ sub, pathParameters: { date, exerciseId } }), deps).then(parse);

export type ExerciseRow = { exerciseId: string; name: string; group: string; entry: Record<string, unknown> | null; last: Record<string, unknown> | null };
export const exercise = (r: { body: { exercises: ExerciseRow[] } }, id: string) => r.body.exercises.find((e) => e.exerciseId === id);
