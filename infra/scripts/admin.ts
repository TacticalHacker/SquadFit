/**
 * Operator tool for user accounts (spec FR-004, FR-004b).
 *
 *   pnpm admin create-user <username> [--stage dev|prod]
 *   pnpm admin reset-password <username> [--stage dev|prod]
 *   pnpm admin list-users [--stage dev|prod]
 *   pnpm admin ai-key issue|revoke <username> [--stage dev|prod]   (feature 004: AI client access keys)
 *   pnpm admin ai-key list [--stage dev|prod]
 *   pnpm admin waitlist list [--stage dev|prod]                    (feature 009: invite requests, newest first)
 *
 * Needs AWS credentials for the target account (AWS_PROFILE etc).
 */
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from "@aws-sdk/client-cognito-identity-provider";
import { UsernameSchema } from "@calci/shared";
import { generateToken, hashToken } from "@calci/shared/ai-credential";
import { DynamoCredentialRepo } from "../../services/api/src/lib/credential-repo";
import { DynamoWaitlistRepo } from "../../services/api/src/lib/waitlist-repo";
import { formatSnippets, parseAiKeySubcommand } from "./ai-key";
import { generateTempPassword } from "./temp-password";

const USAGE = `Usage:
  pnpm admin create-user <username> [--stage dev|prod]
  pnpm admin reset-password <username> [--stage dev|prod]
  pnpm admin list-users [--stage dev|prod]
  pnpm admin ai-key issue|revoke <username> [--stage dev|prod]
  pnpm admin ai-key list [--stage dev|prod]
  pnpm admin waitlist list [--stage dev|prod]`;

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
  const [command, username, third] = args;
  return { command, username, third, stage };
}

async function stackOutput(stack: "Auth" | "Data" | "Api", key: string, stage: string, region: string): Promise<string> {
  const cfn = new CloudFormationClient({ region });
  try {
    const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: `Calci-${stage}-${stack}` }));
    const value = Stacks?.[0]?.Outputs?.find((o) => o.OutputKey === key)?.OutputValue;
    if (value) return value;
  } catch {
    // fall through to the message below
  }
  return fail(`Could not find the ${key} output of stack Calci-${stage}-${stack} in ${region}. Is it deployed (pnpm deploy:${stage})?`);
}

const findUserPoolId = (stage: string, region: string) => stackOutput("Auth", "UserPoolId", stage, region);

/** Cognito username → the `sub` that every table item is keyed by. */
async function findUserSub(idp: CognitoIdentityProviderClient, userPoolId: string, username: string): Promise<string> {
  try {
    const res = await idp.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }));
    const sub = res.UserAttributes?.find((a) => a.Name === "sub")?.Value;
    if (sub) return sub;
  } catch (err) {
    if (!(err instanceof Error && err.name === "UserNotFoundException")) throw err;
  }
  return fail("No such user");
}

/** AI client access keys (feature 004): the secret is printed once and only its hash is stored. */
async function aiKey(sub: string | undefined, username: string | undefined, stage: string, region: string, idp: CognitoIdentityProviderClient, userPoolId: string) {
  const action = parseAiKeySubcommand(sub);
  if (!action) return fail(USAGE);
  const repo = new DynamoCredentialRepo(await stackOutput("Data", "TableName", stage, region));

  if (action === "list") {
    const users = await listAllUsers(idp, userPoolId);
    const rows = [];
    for (const u of users) {
      const id = u.Attributes?.find((a) => a.Name === "sub")?.Value;
      const cred = id ? await repo.get(id) : null;
      rows.push({ username: u.Username, hasKey: Boolean(cred), issued: cred?.createdAt.slice(0, 10) ?? "" });
    }
    console.table(rows); // never prints secrets or hashes
    return;
  }

  const name = requireUsername(username);
  const userId = await findUserSub(idp, userPoolId, name);
  if (action === "revoke") {
    console.log((await repo.revoke(userId)) ? `Revoked the AI key for ${name}.` : `${name} has no AI key.`);
    return;
  }
  const token = generateToken();
  await repo.issue(userId, hashToken(token), new Date().toISOString());
  const mcpUrl = `${await stackOutput("Api", "ApiUrl", stage, region)}/mcp`;
  console.log(`AI key for ${name} (shown once; issuing again rotates it and the old key stops working):`);
  console.log(`\n${token}\n`);
  console.log(formatSnippets(mcpUrl, token));
}

async function listAllUsers(idp: CognitoIdentityProviderClient, userPoolId: string): Promise<UserType[]> {
  const users: UserType[] = [];
  let token: string | undefined;
  do {
    const res = await idp.send(new ListUsersCommand({ UserPoolId: userPoolId, PaginationToken: token }));
    users.push(...(res.Users ?? []));
    token = res.PaginationToken;
  } while (token);
  return users;
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
  const { command, username, third, stage } = parseArgs(process.argv.slice(2));
  const region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1";
  if (!command) fail(USAGE);

  // Feature 009: no Cognito needed.
  if (command === "waitlist") {
    if (username !== "list") fail(USAGE);
    const rows = await new DynamoWaitlistRepo(await stackOutput("Data", "TableName", stage, region)).list();
    if (rows.length === 0) return void console.log("No invite requests yet.");
    for (const r of rows) console.log(`${r.createdAt}  ${r.primaryGoal.padEnd(15)}  ${r.name} <${r.email}>`);
    return;
  }

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
    case "ai-key":
      return aiKey(username, third, stage, region, idp, userPoolId);
    case "list-users": {
      const users = await listAllUsers(idp, userPoolId);
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
