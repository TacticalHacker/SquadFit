import { Suspense } from "react";
import { safeNextPath } from "@/server/cookie-config";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · SquadFit" };

async function SignInContent({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const next = safeNextPath(first(params.next));
  const notice = first(params.error) === "expired" ? "Please sign in again." : undefined;
  return <SignInForm next={next} notice={notice} />;
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">SquadFit</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Sign in to log your workouts and meals.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <SignInContent searchParams={props.searchParams} />
      </Suspense>
      <p className="text-sm text-zinc-500">Accounts are created by invitation. Ask the admin for yours.</p>
    </main>
  );
}
