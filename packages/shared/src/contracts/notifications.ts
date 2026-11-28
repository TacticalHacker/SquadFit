import { z } from "zod";
import { DateSchema } from "../domain/day";
import { NOTIFICATION_LIMIT } from "../domain/notifications";
import { SquadMemberSchema } from "./squad";
import { ClubSchema, ReactionTypeSchema } from "./squad-boards";

/** Feature 022 API shapes (specs/022-reaction-notifications/contracts/api.md). All strict (constitution VI). */

export const NotificationItemKindSchema = z.enum(["pr", "streak_week", "first_workout", "protein_streak", "step_streak", "badge", "workout_day"]);

export const NotificationSchema = z.strictObject({
  id: z.string(),
  /** null: the reactor is hidden from the squad (or gone), shown as "Someone". */
  reactor: SquadMemberSchema.nullable(),
  types: z.array(ReactionTypeSchema).min(1),
  item: z.strictObject({
    /** Feed id `<owner>~<eventId>`. */
    id: z.string(),
    ownerId: z.string(),
    kind: NotificationItemKindSchema,
    date: DateSchema,
    exerciseName: z.string().nullable(),
    week: z.number().int().nullable(),
    club: ClubSchema.nullable(),
  }),
  at: z.iso.datetime(),
  unread: z.boolean(),
});
export type NotificationView = z.infer<typeof NotificationSchema>;

export const NotificationsSchema = z.strictObject({
  items: z.array(NotificationSchema).max(NOTIFICATION_LIMIT),
  unreadCount: z.number().int().min(0),
  /** Newest `at` in items; pass it to PUT /me/notifications/seen. */
  latestAt: z.iso.datetime().nullable(),
});
export type Notifications = z.infer<typeof NotificationsSchema>;

export const NotificationsSeenInputSchema = z.strictObject({ upTo: z.iso.datetime() });
export const NotificationsSeenResultSchema = z.strictObject({ unreadCount: z.number().int().min(0) });

const ReactorGroup = z.strictObject({ members: z.array(SquadMemberSchema), others: z.number().int().min(0) });
export const ReactorsSchema = z.strictObject({ fire: ReactorGroup, muscle: ReactorGroup, crown: ReactorGroup });
export type Reactors = z.infer<typeof ReactorsSchema>;
