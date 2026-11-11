import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
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
      <p className="text-sm text-zinc-500">
        Username: <span className="font-medium text-zinc-900 dark:text-zinc-100">{username}</span> (can&apos;t be changed)
      </p>
      <ProfileForm
        mode="edit"
        submitLabel="Save"
        initial={{
          displayName: profile.displayName,
          timezone: profile.timezone,
          dailyCalorieTarget: profile.dailyCalorieTarget,
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

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ProfileSection />
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
