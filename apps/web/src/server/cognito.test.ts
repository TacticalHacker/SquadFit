import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  changePassword,
  initiateUserPasswordAuth,
  refreshAccessToken,
  respondNewPassword,
  revokeRefreshToken,
} from "./cognito";

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const err = (type: string, message: string) => ({ __type: type, message });

beforeEach(() => {
  process.env.COGNITO_REGION = "us-east-1";
  process.env.COGNITO_CLIENT_ID = "client123";
});
afterEach(() => vi.unstubAllGlobals());

describe("initiateUserPasswordAuth", () => {
  it("returns tokens on success and calls the right endpoint/target", async () => {
    const f = stubFetch(200, {
      AuthenticationResult: { AccessToken: "at", RefreshToken: "rt", ExpiresIn: 3600 },
    });
    const r = await initiateUserPasswordAuth("alice", "pw");
    expect(r).toEqual({ kind: "tokens", accessToken: "at", refreshToken: "rt", expiresIn: 3600 });

    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://cognito-idp.us-east-1.amazonaws.com/");
    expect((init.headers as Record<string, string>)["X-Amz-Target"]).toBe("AWSCognitoIdentityProviderService.InitiateAuth");
    expect(JSON.parse(init.body as string)).toEqual({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: "client123",
      AuthParameters: { USERNAME: "alice", PASSWORD: "pw" },
    });
  });

  it("returns the NEW_PASSWORD_REQUIRED challenge", async () => {
    stubFetch(200, { ChallengeName: "NEW_PASSWORD_REQUIRED", Session: "sess" });
    expect(await initiateUserPasswordAuth("alice", "temp")).toEqual({ kind: "challenge", session: "sess" });
  });

  it("maps wrong password and unknown user to the same error (FR-007)", async () => {
    stubFetch(400, err("NotAuthorizedException", "Incorrect username or password."));
    const wrong = await initiateUserPasswordAuth("alice", "x");
    stubFetch(400, err("UserNotFoundException", "User does not exist."));
    const unknown = await initiateUserPasswordAuth("nobody", "x");
    expect(wrong).toEqual({ kind: "error", error: "invalid_credentials" });
    expect(unknown).toEqual(wrong);
  });

  it("maps lockout", async () => {
    stubFetch(400, err("NotAuthorizedException", "Password attempts exceeded"));
    expect(await initiateUserPasswordAuth("alice", "x")).toEqual({ kind: "error", error: "locked_out" });
  });

  it("handles namespaced __type values", async () => {
    stubFetch(400, err("com.amazonaws.cognito#NotAuthorizedException", "Incorrect username or password."));
    expect(await initiateUserPasswordAuth("a", "b")).toEqual({ kind: "error", error: "invalid_credentials" });
  });

  it("maps unexpected failures to unknown without throwing", async () => {
    stubFetch(500, { message: "boom" });
    expect(await initiateUserPasswordAuth("a", "b")).toEqual({ kind: "error", error: "unknown" });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network"))));
    expect(await initiateUserPasswordAuth("a", "b")).toEqual({ kind: "error", error: "unknown" });
  });
});

describe("respondNewPassword", () => {
  it("returns tokens", async () => {
    const f = stubFetch(200, { AuthenticationResult: { AccessToken: "at", RefreshToken: "rt", ExpiresIn: 3600 } });
    expect((await respondNewPassword("alice", "sess", "newpassword1")).kind).toBe("tokens");
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: "sess",
      ChallengeResponses: { USERNAME: "alice", NEW_PASSWORD: "newpassword1" },
    });
  });
  it("maps a rejected password", async () => {
    stubFetch(400, err("InvalidPasswordException", "Password did not conform with policy"));
    expect(await respondNewPassword("a", "s", "x")).toEqual({ kind: "error", error: "invalid_password" });
  });
  it("maps an expired challenge session", async () => {
    stubFetch(400, err("NotAuthorizedException", "Invalid session for the user, session is expired."));
    expect(await respondNewPassword("a", "s", "x")).toEqual({ kind: "error", error: "expired_session" });
  });
});

describe("refreshAccessToken", () => {
  it("returns a new access token without a refresh token", async () => {
    stubFetch(200, { AuthenticationResult: { AccessToken: "at2", ExpiresIn: 3600 } });
    expect(await refreshAccessToken("rt")).toEqual({ kind: "tokens", accessToken: "at2", expiresIn: 3600 });
  });
  it("reports an invalid refresh token", async () => {
    stubFetch(400, err("NotAuthorizedException", "Refresh Token has been revoked"));
    expect(await refreshAccessToken("rt")).toEqual({ kind: "error", error: "invalid_credentials" });
  });
});

describe("changePassword", () => {
  it("returns ok", async () => {
    stubFetch(200, {});
    expect(await changePassword("at", "old", "newpassword1")).toEqual({ kind: "ok" });
  });
  it("wrong current password", async () => {
    stubFetch(400, err("NotAuthorizedException", "Incorrect username or password."));
    expect(await changePassword("at", "bad", "newpassword1")).toEqual({ kind: "error", error: "invalid_credentials" });
  });
  it("rejected new password", async () => {
    stubFetch(400, err("InvalidPasswordException", "too short"));
    expect(await changePassword("at", "old", "x")).toEqual({ kind: "error", error: "invalid_password" });
  });
  it("rate limited", async () => {
    stubFetch(400, err("LimitExceededException", "Attempt limit exceeded, please try after some time."));
    expect(await changePassword("at", "old", "newpassword1")).toEqual({ kind: "error", error: "locked_out" });
  });
});

describe("revokeRefreshToken", () => {
  it("never throws, even if the call fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network"))));
    await expect(revokeRefreshToken("rt")).resolves.toBeUndefined();
  });
});
