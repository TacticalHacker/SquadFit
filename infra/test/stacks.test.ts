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
      "DELETE /food/foods/{foodId}"]) {
      apiT.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: key });
    }
  });

  it("protects every route except /health with the JWT authorizer", () => {
    const routes = apiT.findResources("AWS::ApiGatewayV2::Route");
    for (const route of Object.values(routes)) {
      const props = route.Properties as { RouteKey: string; AuthorizationType?: string };
      if (props.RouteKey === "GET /health") expect(props.AuthorizationType).toBe("NONE");
      else expect(props.AuthorizationType, props.RouteKey).toBe("JWT");
    }
  });

  it("has no CORS configuration (only the Next.js server calls the API)", () => {
    const apis = apiT.findResources("AWS::ApiGatewayV2::Api");
    for (const a of Object.values(apis)) expect(a.Properties.CorsConfiguration).toBeUndefined();
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
