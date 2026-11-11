import { initials } from "@calci/shared";

/** Photo when there is one, otherwise the user's initials (FR-013). */
export function Avatar({
  displayName,
  avatarUrl,
  size = 40,
}: {
  displayName: string;
  avatarUrl: string | null;
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- short-lived presigned S3 URL; next/image can't optimise it
      <img src={avatarUrl} alt="" width={size} height={size} style={style} className="shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
    >
      {initials(displayName)}
    </span>
  );
}
