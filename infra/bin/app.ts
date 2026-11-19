#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { AWS_REGION, getStageConfig } from "../lib/config";
import { DataStack } from "../lib/data-stack";
import { ApiStack } from "../lib/api-stack";
import { AuthStack } from "../lib/auth-stack";

const app = new App();
const config = getStageConfig(app.node.tryGetContext("stage"));
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: AWS_REGION,
};

const prefix = `Calci-${config.stage}`;
const data = new DataStack(app, `${prefix}-Data`, { env, config });
const auth = new AuthStack(app, `${prefix}-Auth`, { env, config });
new ApiStack(app, `${prefix}-Api`, {
  env,
  config,
  table: data.table,
  avatarBucket: data.avatarBucket,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});

Tags.of(app).add("project", "calci");
Tags.of(app).add("stage", config.stage);
