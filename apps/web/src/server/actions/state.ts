/** Shape returned by every Server Action used with useActionState. */
export interface ActionState {
  error?: string;
  fields?: Record<string, string>;
  message?: string;
}
