import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { SquadSettingsForm } from "@/components/squad-settings-form";
import { secondaryButtonClass } from "@/components/form-bits";
import { removeAvatar } from "@/server/actions/profile";
import { requireProfile } from "@/server/session";
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
      <SquadSettingsForm initial={profile.squad} hasBodyWeight={profile.bodyWeightKg !== null} />
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
      <section aria-labelledby="password-heading" className="flex flex-col gap-4">
        <h2 id="password-heading" className="text-xl font-semibold">
          Password
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}
