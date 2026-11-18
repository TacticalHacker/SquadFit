import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyHandlerV2WithJWTAuthorizer } from "aws-lambda";
import { DateSchema, TIMELINE_PAGE_DAYS, TimelineSchema, addDays, buildDayCards, localDate, pageTimeline } from "@calci/shared";
import { getCaller } from "../lib/auth";
import { getDeps, type Deps } from "../lib/deps";
import { apiError, ok } from "../lib/http";
import { resolveMember } from "../lib/member-access";
import { dayCard, loadHighFives } from "../lib/member-view";
import { feedId } from "../lib/squad-repo";
import type { EntryItem } from "../lib/workout-repo";

const WINDOW_DAYS = 90;
const MILESTONES = new Set(["streak_week", "first_workout", "protein_streak"]);

/**
 * GET /squad/members/{memberId}/timeline?cursor=<date> : 10 workout days per page, newest first, with milestones
 * merged by date (feature 011, research R3). The cursor is the oldest date already shown.
 */
export async function handle(event: APIGatewayProxyEventV2WithJWTAuthorizer, deps: Deps) {
  const caller = getCaller(event);
  if (!(await deps.profiles.get(caller.userId))) return apiError(409, "PROFILE_REQUIRED", "Complete your profile first");
  const access = await resolveMember(caller.userId, event.pathParameters?.memberId, deps);
  if (!access.ok) return access.response;
  const { profile } = access;

  const rawCursor = event.queryStringParameters?.cursor;
  if (rawCursor !== undefined && !DateSchema.safeParse(rawCursor).success) {
    return apiError(400, "VALIDATION_FAILED", "Invalid cursor", { cursor: "Use a real date as YYYY-MM-DD" });
  }
  const cursor = rawCursor ?? null;
  const today = localDate(deps.now(), profile.timezone);
  const floor = localDate(new Date(profile.createdAt), profile.timezone);

  // Walk back in windows until there is more than one page of workout days, or the member's first day is reached.
  const stats = await deps.squad.getStats(profile.userId);
  const loaded: EntryItem[] = [];
  let to = cursor ? addDays(cursor, -1) : today;
  for (;;) {
    const from = addDays(to, -(WINDOW_DAYS - 1)) < floor ? floor : addDays(to, -(WINDOW_DAYS - 1));
    if (from <= to) loaded.push(...(await deps.workouts.listEntriesInRange(profile.userId, from, to)));
    if (from <= floor || buildDayCards(loaded, {}).length > TIMELINE_PAGE_DAYS) break;
    to = addDays(from, -1);
  }
  const { page, nextCursor } = pageTimeline(buildDayCards(loaded, {}), cursor);

  const hi5 = await loadHighFives(profile.userId, caller.userId, deps);
  const cards = await Promise.all(
    page.map(async (c) => {
      const card = await dayCard({ owner: profile, viewerId: caller.userId, level: access.level, date: c.date, workouts: loaded, stats, hi5, withSets: false, deps });
      return card;
    }),
  );

  const high = cursor ? addDays(cursor, -1) : "9999-12-31";
  const low = nextCursor === null ? "0000-01-01" : page[page.length - 1]!.date;
  const milestones = [...hi5.byEvent.values()]
    .filter((f) => MILESTONES.has(f.kind) && f.eventDate >= low && f.eventDate <= high && (f.kind !== "protein_streak" || access.level !== "off"))
    .map((f) => ({
      type: "milestone" as const,
      id: feedId(profile.userId, f.eventId),
      kind: f.kind as "streak_week" | "first_workout" | "protein_streak",
      date: f.eventDate,
      week: f.kind === "streak_week" ? ((f.payload.week as number | undefined) ?? null) : null,
      highFives: f.hi5Count,
      highFivedByMe: hi5.mine.has(feedId(profile.userId, f.eventId)),
      canHighFive: !access.isYou,
    }));

  const dayItems = cards.flatMap((c) => (c ? [{ date: c.date, order: 0, item: { type: "day" as const, card: (({ updatedAt: _u, ...rest }) => rest)(c) } }] : []));
  const items = [...dayItems, ...milestones.map((m) => ({ date: m.date, order: 1, item: m }))]
    .sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order)
    .map((x) => x.item);
  return ok(TimelineSchema.parse({ items, nextCursor }));
}

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = (event) => handle(event, getDeps());
