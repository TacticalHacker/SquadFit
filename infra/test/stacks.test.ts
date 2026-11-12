import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";
import { getStageConfig } from "../lib/config";
import { DataStack } from "../lib/data-stack";

describe("stacks", () => {
  const app = new App();
  const config = getStageConfig("dev");
  const data = new DataStack(app, "Data", { config });
  const auth = new AuthStack(app, "Auth", { config });
  const api = new ApiStack(app, "Api", {
    config,
    table: data.table,
    avatarBucket: data.avatarBucket,
    userPool: auth.userPool,
    userPoolClient: auth.userPoolClient,
  });
  const dataT = Template.fromStack(data);
  const authT = Template.fromStack(auth);
  const apiT = Template.fromStack(api);

  it("creates an on-demand single table with pk/sk", () => {
    dataT.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  it("keeps the avatar bucket private and encrypted", () => {
    dataT.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: Match.anyValue(),
    });
  });

  it("user pool: no self sign-up, case-insensitive, min password 8", () => {
    authT.hasResourceProperties("AWS::Cognito::UserPool", {
      AdminCreateUserConfig: Match.objectLike({ AllowAdminCreateUserOnly: true }),
      UsernameConfiguration: { CaseSensitive: false },
      Policies: {
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
          RequireLowercase: false,
          RequireUppercase: false,
          RequireNumbers: false,
          RequireSymbols: false,
        }),
      },
    });
  });

  it("user pool client: password auth, no secret, no user-existence leaks, 365d refresh", () => {
    authT.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      ExplicitAuthFlows: Match.arrayWith(["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]),
      GenerateSecret: false,
      PreventUserExistenceErrors: "ENABLED",
      EnableTokenRevocation: true,
      RefreshTokenValidity: 365 * 24 * 60,
      AccessTokenValidity: 60,
    });
  });

  it("exposes the expected routes", () => {
    for (const key of ["GET /health", "GET /me", "PUT /me/profile", "PUT /me/avatar", "DELETE /me/avatar", "GET /people",
      "GET /workouts", "GET /workouts/summary", "PUT /workouts/entries/{date}/{workoutId}",
      "DELETE /workouts/entries/{date}/{workoutId}", "POST /workouts/custom", "PUT /workouts/custom/{workoutId}",
      "DELETE /workouts/custom/{workoutId}",
      "GET /food", "GET /food/recent", "POST /food/entries/{date}", "PUT /food/entries/{date}/{entryId}",
      "DELETE /food/entries/{date}/{entryId}", "GET /food/foods", "POST /food/foods", "PUT /food/foods/{foodId}",
      "DELETE /food/foods/{foodId}", "GET /coach-note", "ANY /mcp", "POST /food/photos/{date}",
      "GET /workouts/gym", "PUT /workouts/gym/entries/{date}/{exerciseId}", "DELETE /workouts/gym/entries/{date}/{exerciseId}",
      "POST /workouts/gym/exercises", "PUT /workouts/gym/exercises/{exerciseId}", "DELETE /workouts/gym/exercises/{exerciseId}",
      "PUT /coach-note/{date}/actions/{index}", "ANY /mcp/{key}", "GET /public/pulse", "POST /public/waitlist"]) {
      apiT.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: key });
    }
  });

  it("protects every route except /health, /mcp and /public/* with the JWT authorizer", () => {
    const routes = apiT.findResources("AWS::ApiGatewayV2::Route");
    for (const route of Object.values(routes)) {
      const props = route.Properties as { RouteKey: string; AuthorizationType?: string };
      // /mcp is guarded by an operator-issued bearer key checked in the handler (feature 004, research R2).
      // /public/* serve the landing page: two counts and the rate-limited waitlist (feature 009).
      if (["GET /health", "ANY /mcp", "ANY /mcp/{key}", "GET /public/pulse", "POST /public/waitlist"].includes(props.RouteKey)) expect(props.AuthorizationType).toBe("NONE");
      else expect(props.AuthorizationType, props.RouteKey).toBe("JWT");
    }
  });

  it("has no CORS configuration (only the Next.js server calls the API)", () => {
    const apis = apiT.findResources("AWS::ApiGatewayV2::Api");
    for (const a of Object.values(apis)) expect(a.Properties.CorsConfiguration).toBeUndefined();
  });

  it("expires rate-limit counters with a ttl attribute and exposes the table name", () => {
    dataT.hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      TimeToLiveSpecification: { AttributeName: "ttl", Enabled: true },
    });
    expect(Object.keys(dataT.findOutputs("TableName"))).toHaveLength(1);
  });

  it("the MCP function can read and write the table but not the avatar bucket", () => {
    // Each function has its own role; its policy references the role id (least privilege per function).
    const policies = Object.values(apiT.findResources("AWS::IAM::Policy"));
    const json = JSON.stringify(policies.filter((p) => JSON.stringify(p).includes("mcpFnServiceRole")));
    expect(json).toContain("dynamodb:PutItem");
    expect(json).toContain("dynamodb:UpdateItem");
    // It may read food photos (feature 005) but has no other bucket access: no writes or deletes.
    expect(json).not.toContain("s3:PutObject");
    expect(json).not.toContain("s3:DeleteObject");
  });

  it("gym-get reads the table and its indexes but cannot write; gym mutations can write (feature 006)", () => {
    const policies = Object.values(apiT.findResources("AWS::IAM::Policy"));
    const forRole = (role: string) => JSON.stringify(policies.filter((p) => JSON.stringify(p).includes(role)));
    const get = forRole("gymgetFnServiceRole");
    expect(get).toContain("dynamodb:Query");
    expect(get).toContain("/index/*");
    expect(get).not.toContain("dynamodb:PutItem");
    expect(get).not.toContain("s3:");
    for (const role of ["gymentryputFnServiceRole", "gymentrydeleteFnServiceRole", "gymexercisepostFnServiceRole"]) {
      expect(forRole(role), role).toContain("dynamodb:PutItem");
      expect(forRole(role), role).not.toContain("s3:");
    }
  });

  it("anonymous public functions: pulse is read-only, waitlist can write; neither touches the bucket (feature 009)", () => {
    const policies = Object.values(apiT.findResources("AWS::IAM::Policy"));
    const forRole = (role: string) => JSON.stringify(policies.filter((p) => JSON.stringify(p).includes(role)));
    const pulse = forRole("publicpulsegetFnServiceRole");
    expect(pulse).toContain("dynamodb:Query");
    expect(pulse).not.toContain("dynamodb:PutItem");
    expect(pulse).not.toContain("s3:");
    const waitlist = forRole("publicwaitlistpostFnServiceRole");
    expect(waitlist).toContain("dynamodb:PutItem");
    expect(waitlist).not.toContain("s3:");
  });

  it("coach-action-put can update the table but has no bucket access (feature 007)", () => {
    const policies = Object.values(apiT.findResources("AWS::IAM::Policy"));
    const json = JSON.stringify(policies.filter((p) => JSON.stringify(p).includes("coachactionputFnServiceRole")));
    expect(json).toContain("dynamodb:UpdateItem");
    expect(json).not.toContain("s3:");
  });

  it("scopes food photo access to the food-photos/ prefix per function (feature 005)", () => {
    const policies = Object.values(apiT.findResources("AWS::IAM::Policy"));
    const forRole = (role: string) => JSON.stringify(policies.filter((p) => JSON.stringify(p).includes(role)));
    // Photo upload: write and delete, only under the prefix.
    const post = forRole("foodphotopostFnServiceRole");
    expect(post).toContain("s3:PutObject");
    expect(post).toContain("s3:DeleteObject");
    expect(post).toContain("/food-photos/*");
    // Day views and the MCP server can read photos but never write or delete them.
    for (const role of ["foodgetFnServiceRole", "mcpFnServiceRole"]) {
      const json = forRole(role);
      expect(json, role).toContain("s3:GetObject");
      expect(json, role).toContain("/food-photos/*");
      expect(json, role).not.toContain("s3:PutObject");
      expect(json, role).not.toContain("s3:DeleteObject");
    }
  });

  it("runs on Node 24 / arm64", () => {
    apiT.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: Match.stringLikeRegexp("nodejs24"),
      Architectures: ["arm64"],
    });
  });

  it("rejects unknown stages", () => {
    expect(() => getStageConfig("staging")).toThrow();
  });
});
