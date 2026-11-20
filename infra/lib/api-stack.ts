import path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { IUserPool, IUserPoolClient } from "aws-cdk-lib/aws-cognito";
import type { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat, type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { IBucket } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { StageConfig } from "./config";

const here = path.dirname(fileURLToPath(import.meta.url));
const handlersDir = path.resolve(here, "../../services/api/src/handlers");
const repoRoot = path.resolve(here, "../..");

export interface ApiStackProps extends StackProps {
  config: StageConfig;
  table: ITableV2;
  avatarBucket: IBucket;
  userPool: IUserPool;
  userPoolClient: IUserPoolClient;
}

export class ApiStack extends Stack {
  readonly api: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { config, table, avatarBucket, userPool, userPoolClient } = props;

    this.api = new HttpApi(this, "HttpApi", {
      apiName: `calci-${config.stage}`,
      // No CORS: only the Next.js server calls this API (spec 001 research R3).
    });

    const authorizer = new HttpUserPoolAuthorizer("UserPoolAuthorizer", userPool, {
      userPoolClients: [userPoolClient],
    });

    const fnDefaults: Omit<NodejsFunctionProps, "entry"> = {
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      projectRoot: repoRoot,
      depsLockFilePath: path.join(repoRoot, "pnpm-lock.yaml"),
      environment: {
        STAGE: config.stage,
        TABLE_NAME: table.tableName,
        AVATAR_BUCKET: avatarBucket.bucketName,
        NODE_OPTIONS: "--enable-source-maps",
      },
      bundling: {
        format: OutputFormat.ESM,
        minify: true,
        sourceMap: true,
        // AWS SDK v3 ships with the Node.js Lambda runtime.
        externalModules: ["@aws-sdk/*"],
        mainFields: ["module", "main"],
        banner: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
      },
    };

    interface RouteOptions {
      /** Require a valid Cognito access token. Default true. */
      auth?: boolean;
      /** Grant write access to the table (default read-only). */
      write?: boolean;
      /** Grant access to the avatar bucket. */
      avatars?: "read" | "readwrite";
      /** Access to food photos (feature 005), limited to the `food-photos/*` prefix of the private bucket. */
      photos?: "read" | "readwrite";
      /**
       * Feature 016: photos posted with a workout day, limited to `share-photos/*`. "delete" is for functions whose
       * entry writes can turn a posted day into a rest day (the stats refresh removes its photo).
       */
      sharePhotos?: "read" | "readwrite" | "delete";
      /** Override the default function size/timeout (the MCP function). */
      memorySize?: number;
      timeoutSeconds?: number;
    }

    const route = (name: string, method: HttpMethod, routePath: string, opts: RouteOptions = {}) => {
      const fn = new NodejsFunction(this, `${name}Fn`, {
        ...fnDefaults,
        entry: path.join(handlersDir, `${name}.ts`),
        ...(opts.memorySize ? { memorySize: opts.memorySize } : {}),
        ...(opts.timeoutSeconds ? { timeout: Duration.seconds(opts.timeoutSeconds) } : {}),
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });
      if (opts.write) table.grantReadWriteData(fn);
      else table.grantReadData(fn);
      if (opts.avatars === "read") avatarBucket.grantRead(fn);
      if (opts.avatars === "readwrite") avatarBucket.grantReadWrite(fn);
      if (opts.photos === "read") avatarBucket.grantRead(fn, "food-photos/*");
      if (opts.photos === "readwrite") avatarBucket.grantReadWrite(fn, "food-photos/*");
      if (opts.sharePhotos === "read") avatarBucket.grantRead(fn, "share-photos/*");
      if (opts.sharePhotos === "readwrite") avatarBucket.grantReadWrite(fn, "share-photos/*");
      if (opts.sharePhotos === "delete") avatarBucket.grantDelete(fn, "share-photos/*");
      this.api.addRoutes({
        path: routePath,
        methods: [method],
        integration: new HttpLambdaIntegration(`${name}Integration`, fn),
        ...(opts.auth === false ? {} : { authorizer }),
      });
      return fn;
    };

    route("health", HttpMethod.GET, "/health", { auth: false });
    route("me-get", HttpMethod.GET, "/me", { avatars: "read" });
    route("me-profile-put", HttpMethod.PUT, "/me/profile", { write: true, avatars: "read" });
    route("me-avatar-put", HttpMethod.PUT, "/me/avatar", { write: true, avatars: "readwrite" });
    route("me-avatar-delete", HttpMethod.DELETE, "/me/avatar", { write: true, avatars: "readwrite" });
    route("people-get", HttpMethod.GET, "/people", { avatars: "read" });
    // Workouts (feature 002)
    route("workouts-get", HttpMethod.GET, "/workouts");
    route("workouts-summary-get", HttpMethod.GET, "/workouts/summary");
    route("entry-put", HttpMethod.PUT, "/workouts/entries/{date}/{workoutId}", { write: true, sharePhotos: "delete" });
    route("entry-delete", HttpMethod.DELETE, "/workouts/entries/{date}/{workoutId}", { write: true, sharePhotos: "delete" });
    route("custom-post", HttpMethod.POST, "/workouts/custom", { write: true });
    route("custom-put", HttpMethod.PUT, "/workouts/custom/{workoutId}", { write: true });
    route("custom-delete", HttpMethod.DELETE, "/workouts/custom/{workoutId}", { write: true });
    // Gym logger (feature 006): read-only list (queries gsi1 for "last time"), write-only for mutations.
    route("gym-get", HttpMethod.GET, "/workouts/gym");
    route("gym-entry-put", HttpMethod.PUT, "/workouts/gym/entries/{date}/{exerciseId}", { write: true, sharePhotos: "delete" });
    route("gym-entry-delete", HttpMethod.DELETE, "/workouts/gym/entries/{date}/{exerciseId}", { write: true, sharePhotos: "delete" });
    route("gym-exercise-post", HttpMethod.POST, "/workouts/gym/exercises", { write: true });
    route("gym-exercise-put", HttpMethod.PUT, "/workouts/gym/exercises/{exerciseId}", { write: true });
    route("gym-exercise-delete", HttpMethod.DELETE, "/workouts/gym/exercises/{exerciseId}", { write: true });
    // Squad leaderboard (feature 010): members-only; the boards and feed only read, settings/high-fives/confirm write.
    route("me-squad-put", HttpMethod.PUT, "/me/squad", { write: true });
    route("me-targets-put", HttpMethod.PUT, "/me/targets", { write: true });
    route("gym-entry-confirm-put", HttpMethod.PUT, "/workouts/gym/entries/{date}/{exerciseId}/confirm", { write: true });
    // Feature 013: boards and Hall of Fame replace /squad/leaderboard; reactions replace high-fives.
    route("squad-boards-get", HttpMethod.GET, "/squad/boards", { avatars: "read" });
    route("squad-hall-of-fame-get", HttpMethod.GET, "/squad/hall-of-fame", { avatars: "read" });
    route("squad-feed-get", HttpMethod.GET, "/squad/feed", { avatars: "read", sharePhotos: "read" });
    route("squad-member-get", HttpMethod.GET, "/squad/members/{memberId}", { avatars: "read" });
    route("squad-member-timeline-get", HttpMethod.GET, "/squad/members/{memberId}/timeline", { photos: "read" });
    route("squad-member-day-get", HttpMethod.GET, "/squad/members/{memberId}/days/{date}", { photos: "read" });
    route("squad-today-get", HttpMethod.GET, "/squad/today", { avatars: "read" });
    route("squad-reaction-put", HttpMethod.PUT, "/squad/feed/{id}/reactions/{type}", { write: true });
    route("squad-reaction-delete", HttpMethod.DELETE, "/squad/feed/{id}/reactions/{type}", { write: true });
    // Share a workout day (feature 016): own figures, and posting a day (optional photo under share-photos/).
    route("me-share-get", HttpMethod.GET, "/me/share/{date}");
    route("squad-post-put", HttpMethod.PUT, "/squad/posts/{date}", { write: true, sharePhotos: "readwrite", memorySize: 512, timeoutSeconds: 15 });
    route("squad-post-delete", HttpMethod.DELETE, "/squad/posts/{date}", { write: true, sharePhotos: "readwrite" });
    // Nutrition (feature 003)
    route("food-get", HttpMethod.GET, "/food", { photos: "read" });
    route("food-recent-get", HttpMethod.GET, "/food/recent");
    route("food-entry-post", HttpMethod.POST, "/food/entries/{date}", { write: true, photos: "read" });
    route("food-entry-put", HttpMethod.PUT, "/food/entries/{date}/{entryId}", { write: true, photos: "read" });
    route("food-entry-delete", HttpMethod.DELETE, "/food/entries/{date}/{entryId}", { write: true, photos: "readwrite" });
    // Photo food log (feature 005): pictures are private objects under food-photos/ in the same bucket.
    route("food-photo-post", HttpMethod.POST, "/food/photos/{date}", { write: true, photos: "readwrite", memorySize: 512, timeoutSeconds: 15 });
    route("own-foods-get", HttpMethod.GET, "/food/foods");
    route("own-foods-post", HttpMethod.POST, "/food/foods", { write: true });
    route("own-foods-put", HttpMethod.PUT, "/food/foods/{foodId}", { write: true });
    route("own-foods-delete", HttpMethod.DELETE, "/food/foods/{foodId}", { write: true });

    // AI Coach (feature 004). /mcp has no Cognito authorizer: AI clients send an operator-issued bearer key,
    // verified in the handler. ANY so the handler can answer OPTIONS (CORS) and 405.
    route("coach-note-get", HttpMethod.GET, "/coach-note");
    route("coach-action-put", HttpMethod.PUT, "/coach-note/{date}/actions/{index}", { write: true });
    const mcpFn = route("mcp", HttpMethod.ANY, "/mcp", { auth: false, write: true, photos: "read", memorySize: 512, timeoutSeconds: 15 });
    // Feature 008: same function, key in the path for clients that can't send headers (ChatGPT "No authentication").
    this.api.addRoutes({ path: "/mcp/{key}", methods: [HttpMethod.ANY], integration: new HttpLambdaIntegration("mcpKeyIntegration", mcpFn) });

    // Health activity sync (feature 012). /integrations/activity has no Cognito authorizer: an iPhone Shortcut or the
    // Health Auto Export app sends the member's sfh_ Health sync token, verified in the handler (write-only scope).
    route("integrations-activity-post", HttpMethod.POST, "/integrations/activity", { auth: false, write: true });
    route("me-health-sync-get", HttpMethod.GET, "/me/health-sync");
    route("me-health-token-post", HttpMethod.POST, "/me/health-token", { write: true });
    route("me-health-token-delete", HttpMethod.DELETE, "/me/health-token", { write: true });
    route("me-steps-put", HttpMethod.PUT, "/me/steps", { write: true });
    // Exercise admin (feature 015): Cognito-authorized; each handler also requires the "admin" group (403 otherwise).
    route("admin-exercises-get", HttpMethod.GET, "/admin/exercises");
    route("admin-exercise-post", HttpMethod.POST, "/admin/exercises", { write: true });
    route("admin-exercise-put", HttpMethod.PUT, "/admin/exercises/{exerciseId}", { write: true });
    route("admin-exercise-merge-post", HttpMethod.POST, "/admin/exercises/{exerciseId}/merge", { write: true, timeoutSeconds: 60, sharePhotos: "delete" });
    // Story 5: admins create member accounts. The only function with the pool id and a Cognito admin permission,
    // and only AdminCreateUser on this pool (FR-023). No table access is needed beyond the default read.
    const adminUserFn = route("admin-user-post", HttpMethod.POST, "/admin/users");
    adminUserFn.addEnvironment("USER_POOL_ID", userPool.userPoolId);
    userPool.grant(adminUserFn, "cognito-idp:AdminCreateUser");

    // Public landing page (feature 009): anonymous, called only by the Next server. Pulse returns two counts
    // (constitution VI); the waitlist is rate-limited and dedupes by email in the handler.
    route("public-pulse-get", HttpMethod.GET, "/public/pulse", { auth: false });
    route("public-waitlist-post", HttpMethod.POST, "/public/waitlist", { auth: false, write: true });

    new CfnOutput(this, "ApiUrl", { value: this.api.apiEndpoint });
  }
}
