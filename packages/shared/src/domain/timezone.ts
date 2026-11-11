/** True when `tz` is an IANA zone the runtime recognises. Both old (Asia/Calcutta) and new (Asia/Kolkata) names pass. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Zones for the picker. `Intl.supportedValuesOf` only lists canonical names, so it can omit
 * "UTC" and the name the device itself reports (e.g. Asia/Kolkata vs Asia/Calcutta).
 * We add both so the pre-filled value is always selectable (FR-012).
 */
export function listTimeZones(deviceZone?: string): string[] {
  const zones = new Set<string>(Intl.supportedValuesOf("timeZone"));
  zones.add("UTC");
  if (deviceZone && isValidTimeZone(deviceZone)) zones.add(deviceZone);
  return [...zones].sort();
}
