#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { getStageConfig } from "../lib/config";
import { DataStack } from "../lib/data-stack";
import { ApiStack } from "../lib/api-stack";

const app = new App();
const config = getStageConfig(app.node.tryGetContext("stage"));
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "us-east-1",
};

const prefix = `Calci-${config.stage}`;
const data = new DataStack(app, `${prefix}-Data`, { env, config });
new ApiStack(app, `${prefix}-Api`, { env, config, table: data.table });

Tags.of(app).add("project", "calci");
Tags.of(app).add("stage", config.stage);
