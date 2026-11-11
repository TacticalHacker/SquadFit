import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { requireNoProfile } from "@/server/session";

export const metadata = { title: "Set up your profile · SquadFit" };

async function SetupContent() {
  const { username } = await requireNoProfile();
  return <ProfileForm mode="setup" submitLabel="Join" initial={{ displayName: username, avatarUrl: null }} />;
}

export default function SetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Set up your profile</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Everyone on SquadFit shares one leaderboard. Pick the name and photo your friends will see.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <SetupContent />
      </Suspense>
    </main>
  );
}
