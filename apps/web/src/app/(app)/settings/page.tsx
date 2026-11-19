import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { SquadSettingsForm } from "@/components/squad-settings-form";
import { noticeWarnClass, secondaryButtonClass } from "@/components/form-bits";
import { removeAvatar } from "@/server/actions/profile";
import { requireProfile } from "@/server/session";
import { HealthSyncStatusSchema } from "@calci/shared";
import { HealthSyncSection } from "@/components/health-sync-section";
import { apiFetch } from "@/server/api";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Settings · SquadFit" };

async function ProfileSection() {
  const { username, profile } = await requireProfile();
  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-4">
      <h2 id="profile-heading" className="text-xl font-semibold">
        Profile
      </h2>
      <p className="text-sm text-muted">
        Username: <span className="font-medium text-ink">{username}</span> (can&apos;t be changed)
      </p>
      {profile.targetsConfirmed ? null : (
        <p className={noticeWarnClass}>Your daily goals aren&apos;t confirmed yet. Check them and save to share them with the squad.</p>
      )}
      <ProfileForm
        mode="edit"
        submitLabel="Save"
        initial={{
          displayName: profile.displayName,
          timezone: profile.timezone,
          dailyCalorieTarget: profile.dailyCalorieTarget,
          dailyProteinTarget: profile.dailyProteinTarget,
          bodyWeightKg: profile.bodyWeightKg,
          avatarUrl: profile.avatarUrl,
        }}
      />
      {profile.avatarUrl ? (
        <form action={removeAvatar}>
          <button type="submit" className={secondaryButtonClass}>
            Remove photo
          </button>
        </form>
      ) : null}
    </section>
  );
}

async function SquadSection() {
  const { profile } = await requireProfile();
  return (
    <section id="squad" aria-labelledby="squad-heading" className="flex flex-col gap-4">
      <h2 id="squad-heading" className="text-xl font-semibold">
        Squad
      </h2>
      <SquadSettingsForm initial={profile.squad} />
    </section>
  );
}

const SOURCE_LABEL = { mcp: "AI agent", shortcut: "Shortcut", health_auto_export: "Health Auto Export", manual: "Manual" } as const;

/** Only an https link is used for the Shortcut button (feature 012); anything else hides it. */
function shortcutUrl(): string | null {
  const raw = process.env.HEALTH_SHORTCUT_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

async function HealthSection() {
  const { profile } = await requireProfile();
  const status = await apiFetch("/me/health-sync", { schema: HealthSyncStatusSchema });
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  return (
    <section id="health" aria-labelledby="health-heading" className="flex flex-col gap-4">
      <h2 id="health-heading" className="text-xl font-semibold">
        Apple Health sync
      </h2>
      <HealthSyncSection
        view={{
          token: status.token ? { created: fmt(status.token.createdAt), lastUsed: status.token.lastUsedAt ? fmt(status.token.lastUsedAt) : null } : null,
          lastSync: status.lastSync ? { when: fmt(status.lastSync.syncedAt), source: SOURCE_LABEL[status.lastSync.source] } : null,
          steps: status.steps,
        }}
        endpointUrl={`${process.env.API_URL ?? ""}/integrations/activity`}
        shortcutUrl={shortcutUrl()}
      />
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-semibold tracking-[-0.02em]">Settings</h1>
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <ProfileSection />
      </Suspense>
      <Suspense fallback={null}>
        <SquadSection />
      </Suspense>
      <Suspense fallback={null}>
        <HealthSection />
      </Suspense>
      <section aria-labelledby="password-heading" className="flex flex-col gap-4">
        <h2 id="password-heading" className="text-xl font-semibold">
          Password
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}
