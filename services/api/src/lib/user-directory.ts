import { AdminCreateUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

/**
 * Feature 015 (Story 5): admins create member accounts from the panel, like `pnpm admin create-user`. No invitation
 * message (no email on file); Cognito forces a new password at first sign-in. Never log usernames or passwords.
 */
export interface UserDirectory {
  create(username: string, temporaryPassword: string): Promise<"ok" | "taken">;
}

export class CognitoUserDirectory implements UserDirectory {
  constructor(
    private readonly userPoolId: string,
    private readonly client = new CognitoIdentityProviderClient({}),
  ) {}

  async create(username: string, temporaryPassword: string) {
    try {
      await this.client.send(
        new AdminCreateUserCommand({ UserPoolId: this.userPoolId, Username: username, TemporaryPassword: temporaryPassword, MessageAction: "SUPPRESS" }),
      );
      return "ok" as const;
    } catch (err) {
      if (err instanceof Error && err.name === "UsernameExistsException") return "taken" as const;
      throw err;
    }
  }
}
