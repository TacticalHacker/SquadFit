import "server-only";

/**
 * Minimal client for the Cognito user-pool JSON API (spec 001 research R4).
 * These operations are unauthenticated (they only need the app client id), so Vercel needs no AWS credentials.
 * Passwords and tokens are never logged.
 */

export type AuthErrorKind =
  | "invalid_credentials" // wrong password, unknown user, bad refresh token (indistinguishable on purpose, FR-007)
  | "locked_out"
  | "expired_session"
  | "invalid_password"
  | "unknown";

export type TokensResult = { kind: "tokens"; accessToken: string; refreshToken?: string; expiresIn: number };
export type AuthResult = TokensResult | { kind: "challenge"; session: string } | { kind: "error"; error: AuthErrorKind };
export type OkResult = { kind: "ok" } | { kind: "error"; error: AuthErrorKind };

interface CognitoErrorBody {
  __type?: string;
  message?: string;
  Message?: string;
}

function config() {
  const region = process.env.COGNITO_REGION;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!region || !clientId) throw new Error("COGNITO_REGION and COGNITO_CLIENT_ID must be set (see .env.example)");
  return { region, clientId };
}

type Call = { ok: true; data: Record<string, unknown> } | { ok: false; type: string; message: string };

async function call(target: string, body: Record<string, unknown>): Promise<Call> {
  const { region } = config();
  try {
    // COGNITO_ENDPOINT is only for local testing against a fake identity provider.
    const endpoint = process.env.COGNITO_ENDPOINT ?? `https://cognito-idp.${region}.amazonaws.com/`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & CognitoErrorBody;
    if (res.ok) return { ok: true, data };
    const type = (data.__type ?? "").split("#").pop() ?? "";
    return { ok: false, type, message: data.message ?? data.Message ?? "" };
  } catch {
    return { ok: false, type: "NetworkError", message: "" };
  }
}

function mapError(c: { type: string; message: string }): AuthErrorKind {
  const msg = c.message.toLowerCase();
  switch (c.type) {
    case "NotAuthorizedException":
      if (msg.includes("attempts exceeded")) return "locked_out";
      if (msg.includes("session")) return "expired_session";
      return "invalid_credentials";
    case "UserNotFoundException":
    case "PasswordResetRequiredException":
    case "UserNotConfirmedException":
      return "invalid_credentials";
    case "InvalidPasswordException":
    case "InvalidParameterException":
      return "invalid_password";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "locked_out";
    case "ExpiredCodeException":
    case "CodeMismatchException":
      return "expired_session";
    default:
      return "unknown";
  }
}

function toAuthResult(c: Call): AuthResult {
  if (!c.ok) return { kind: "error", error: mapError(c) };
  const result = c.data.AuthenticationResult as
    | { AccessToken?: string; RefreshToken?: string; ExpiresIn?: number }
    | undefined;
  if (result?.AccessToken) {
    return {
      kind: "tokens",
      accessToken: result.AccessToken,
      ...(result.RefreshToken ? { refreshToken: result.RefreshToken } : {}),
      expiresIn: result.ExpiresIn ?? 3600,
    };
  }
  if (c.data.ChallengeName === "NEW_PASSWORD_REQUIRED" && typeof c.data.Session === "string") {
    return { kind: "challenge", session: c.data.Session };
  }
  return { kind: "error", error: "unknown" };
}

export async function initiateUserPasswordAuth(username: string, password: string): Promise<AuthResult> {
  const { clientId } = config();
  return toAuthResult(
    await call("InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  );
}

export async function respondNewPassword(username: string, session: string, newPassword: string): Promise<AuthResult> {
  const { clientId } = config();
  return toAuthResult(
    await call("RespondToAuthChallenge", {
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: clientId,
      Session: session,
      ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
    }),
  );
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  const { clientId } = config();
  return toAuthResult(
    await call("InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: clientId,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    }),
  );
}

export async function changePassword(accessToken: string, previous: string, proposed: string): Promise<OkResult> {
  const c = await call("ChangePassword", {
    AccessToken: accessToken,
    PreviousPassword: previous,
    ProposedPassword: proposed,
  });
  return c.ok ? { kind: "ok" } : { kind: "error", error: mapError(c) };
}

/** Best effort: signing out must succeed locally even if Cognito is unreachable. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    const { clientId } = config();
    await call("RevokeToken", { Token: refreshToken, ClientId: clientId });
  } catch {
    // ignore
  }
}
