"use server";

import { redirect } from "next/navigation";
import { PasswordSchema, UsernameSchema } from "@calci/shared";
import {
  changePassword as cognitoChangePassword,
  initiateUserPasswordAuth,
  respondNewPassword,
  revokeRefreshToken,
} from "../cognito";
import { safeNextPath } from "../cookie-config";
import {
  clearSessionCookies,
  readAccessToken,
  readChallenge,
  readRefreshToken,
  setChallengeCookie,
  setSessionCookies,
} from "../cookies";
import type { ActionState } from "./state";

const str = (fd: FormData, key: string) => (typeof fd.get(key) === "string" ? (fd.get(key) as string) : "");

const BAD_CREDENTIALS = "Incorrect username or password";
const LOCKED_OUT = "Too many attempts. Try again in a few minutes.";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = str(formData, "username").trim();
  const password = str(formData, "password");
  const next = safeNextPath(str(formData, "next"));

  // Same message for every failure so usernames can't be probed (FR-007).
  if (!UsernameSchema.safeParse(username).success || !password) return { error: BAD_CREDENTIALS };

  const result = await initiateUserPasswordAuth(username, password);
  switch (result.kind) {
    case "tokens":
      await setSessionCookies(result);
      redirect(next);
    case "challenge":
      await setChallengeCookie(username, result.session);
      redirect("/sign-in/new-password");
    case "error":
      return { error: result.error === "locked_out" ? LOCKED_OUT : result.error === "unknown" ? "Something went wrong. Try again." : BAD_CREDENTIALS };
  }
}

export async function setNewPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const challenge = await readChallenge();
  if (!challenge) redirect("/sign-in?error=expired");

  const newPassword = str(formData, "newPassword");
  const parsed = PasswordSchema.safeParse(newPassword);
  if (!parsed.success) return { fields: { newPassword: parsed.error.issues[0]?.message ?? "Invalid password" } };
  if (newPassword !== str(formData, "confirm")) return { fields: { confirm: "Passwords don't match" } };

  const result = await respondNewPassword(challenge.username, challenge.session, newPassword);
  if (result.kind === "tokens") {
    await setSessionCookies(result); // also clears the challenge cookie
    redirect("/setup"); // /setup bounces to the app if a profile already exists
  }
  if (result.kind === "error") {
    if (result.error === "expired_session") redirect("/sign-in?error=expired");
    if (result.error === "invalid_password") return { fields: { newPassword: "That password isn't allowed. Try a longer one." } };
    if (result.error === "locked_out") return { error: LOCKED_OUT };
  }
  return { error: "Something went wrong. Try again." };
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const current = str(formData, "current");
  const next = str(formData, "newPassword");
  if (!current) return { fields: { current: "Enter your current password" } };
  const parsed = PasswordSchema.safeParse(next);
  if (!parsed.success) return { fields: { newPassword: parsed.error.issues[0]?.message ?? "Invalid password" } };
  if (next !== str(formData, "confirm")) return { fields: { confirm: "Passwords don't match" } };

  const token = await readAccessToken();
  if (!token) redirect("/sign-in");

  const result = await cognitoChangePassword(token, current, next);
  if (result.kind === "ok") return { message: "Password changed" };
  switch (result.error) {
    case "invalid_credentials":
      return { fields: { current: "Current password is incorrect" } };
    case "invalid_password":
      return { fields: { newPassword: "That password isn't allowed. Try a longer one." } };
    case "locked_out":
      return { error: LOCKED_OUT };
    default:
      return { error: "Something went wrong. Try again." };
  }
}

export async function signOut(): Promise<void> {
  const refresh = await readRefreshToken();
  if (refresh) await revokeRefreshToken(refresh);
  await clearSessionCookies();
  redirect("/sign-in");
}
