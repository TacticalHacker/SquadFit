/**
 * Operator tool for user accounts (spec FR-004, FR-004b).
 *
 *   pnpm admin create-user <username> [--stage dev|prod]
 *   pnpm admin reset-password <username> [--stage dev|prod]
 *   pnpm admin list-users [--stage dev|prod]
 *
 * Needs AWS credentials for the target account (AWS_PROFILE etc).
 */
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { UsernameSchema } from "@calci/shared";
import { generateTempPassword } from "./temp-password";

const USAGE = `Usage:
  pnpm admin create-user <username> [--stage dev|prod]
  pnpm admin reset-password <username> [--stage dev|prod]
  pnpm admin list-users [--stage dev|prod]`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const args = argv.filter((a) => a !== "--");
  const stageIdx = args.indexOf("--stage");
  let stage = "dev";
  if (stageIdx !== -1) {
    stage = args[stageIdx + 1] ?? fail(USAGE);
    args.splice(stageIdx, 2);
  }
  if (stage !== "dev" && stage !== "prod") fail(`Unknown stage "${stage}". Use dev or prod.`);
  const [command, username] = args;
  return { command, username, stage };
}

async function findUserPoolId(stage: string, region: string): Promise<string> {
  const cfn = new CloudFormationClient({ region });
  try {
    const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: `Calci-${stage}-Auth` }));
    const id = Stacks?.[0]?.Outputs?.find((o) => o.OutputKey === "UserPoolId")?.OutputValue;
    if (id) return id;
  } catch {
    // fall through to the message below
  }
  return fail(`Could not find the UserPoolId output of stack Calci-${stage}-Auth in ${region}. Is it deployed (pnpm deploy:${stage})?`);
}

function requireUsername(username: string | undefined): string {
  const parsed = UsernameSchema.safeParse(username);
  if (!parsed.success) return fail(`${parsed.error.issues[0]?.message ?? "Invalid username"}\n${USAGE}`);
  return parsed.data;
}

function printCredentials(username: string, tempPassword: string) {
  // Printed once, never logged elsewhere. Send privately; the user must change it on first sign-in.
  console.log(`username:           ${username}`);
  console.log(`temporary password: ${tempPassword}`);
  console.log("They will be asked to choose a new password when they sign in.");
}

async function main() {
  const { command, username, stage } = parseArgs(process.argv.slice(2));
  const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  if (!command) fail(USAGE);

  const userPoolId = await findUserPoolId(stage, region);
  const idp = new CognitoIdentityProviderClient({ region });

  switch (command) {
    case "create-user": {
      const name = requireUsername(username);
      const tempPassword = generateTempPassword();
      try {
        await idp.send(
          new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: name,
            TemporaryPassword: tempPassword,
            MessageAction: "SUPPRESS", // no email on file
          }),
        );
      } catch (err) {
        if (err instanceof Error && err.name === "UsernameExistsException") fail("Username is taken");
        throw err;
      }
      printCredentials(name, tempPassword);
      return;
    }
    case "reset-password": {
      const name = requireUsername(username);
      const tempPassword = generateTempPassword();
      try {
        await idp.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: userPoolId,
            Username: name,
            Password: tempPassword,
            Permanent: false,
          }),
        );
      } catch (err) {
        if (err instanceof Error && err.name === "UserNotFoundException") fail("No such user");
        throw err;
      }
      printCredentials(name, tempPassword);
      return;
    }
    case "list-users": {
      const users: UserType[] = [];
      let token: string | undefined;
      do {
        const res = await idp.send(new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: token }));
        users.push(...(res.Users ?? []));
        token = res.PaginationToken;
      } while (token);
      console.table(
        users.map((u) => ({
          username: u.Username,
          status: u.UserStatus, // FORCE_CHANGE_PASSWORD until first sign-in
          created: u.UserCreateDate?.toISOString().slice(0, 10),
        })),
      );
      return;
    }
    default:
      fail(`Unknown command "${command}"\n${USAGE}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
