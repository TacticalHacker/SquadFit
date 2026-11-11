import path from "node:path";
import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { ITableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat, type NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { StageConfig } from "./config";

const here = path.dirname(fileURLToPath(import.meta.url));
const handlersDir = path.resolve(here, "../../services/api/src/handlers");
const repoRoot = path.resolve(here, "../..");

export interface ApiStackProps extends StackProps {
  config: StageConfig;
  table: ITableV2;
}

export class ApiStack extends Stack {
  readonly api: HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { config, table } = props;

    this.api = new HttpApi(this, "HttpApi", {
      apiName: `calci-${config.stage}`,
      corsPreflight: {
        allowOrigins: config.allowedOrigins,
        allowMethods: [CorsHttpMethod.ANY],
        allowHeaders: ["authorization", "content-type"],
      },
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

    const route = (name: string, method: HttpMethod, routePath: string, opts: { write?: boolean } = {}) => {
      const fn = new NodejsFunction(this, `${name}Fn`, {
        ...fnDefaults,
        entry: path.join(handlersDir, `${name}.ts`),
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });
      if (opts.write) table.grantReadWriteData(fn);
      else table.grantReadData(fn);
      this.api.addRoutes({
        path: routePath,
        methods: [method],
        integration: new HttpLambdaIntegration(`${name}Integration`, fn),
      });
      return fn;
    };

    route("health", HttpMethod.GET, "/health");

    new CfnOutput(this, "ApiUrl", { value: this.api.apiEndpoint });
  }
}
