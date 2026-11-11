"use client";

import { useEffect, useMemo, useState } from "react";
import { isValidTimeZone, listTimeZones } from "@calci/shared";
import { describedBy, inputClass } from "./form-bits";

/**
 * Pre-fills the device's timezone (FR-012). The device zone is read after mount so server and client
 * render the same markup; if the device reports a zone we don't recognise, the user must pick one.
 */
export function TimezoneSelect({
  id,
  initial,
  error,
}: {
  id: string;
  initial?: string | undefined;
  error?: string | undefined;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [deviceZone, setDeviceZone] = useState<string>();

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && isValidTimeZone(zone)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- must wait for mount: the device zone differs from the server's
      setDeviceZone(zone);
      if (!initial) setValue(zone);
    }
  }, [initial]);

  const zones = useMemo(() => {
    const list = listTimeZones(deviceZone);
    return initial && !list.includes(initial) ? [...list, initial].sort() : list;
  }, [deviceZone, initial]);

  return (
    <select
      id={id}
      name="timezone"
      required
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, error)}
      className={inputClass}
    >
      <option value="" disabled>
        Select your timezone…
      </option>
      {zones.map((z) => (
        <option key={z} value={z}>
          {z.replaceAll("_", " ")}
        </option>
      ))}
    </select>
  );
}
