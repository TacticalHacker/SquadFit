import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { getStageConfig } from "../lib/config";
import { DataStack } from "../lib/data-stack";
import { ApiStack } from "../lib/api-stack";

describe("stacks", () => {
  const app = new App();
  const config = getStageConfig("dev");
  const data = new DataStack(app, "Data", { config });
  const api = new ApiStack(app, "Api", { config, table: data.table });

  it("creates an on-demand single table with pk/sk", () => {
    Template.fromStack(data).hasResourceProperties("AWS::DynamoDB::GlobalTable", {
      KeySchema: [
        { AttributeName: "pk", KeyType: "HASH" },
        { AttributeName: "sk", KeyType: "RANGE" },
      ],
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  it("exposes GET /health on an HTTP API", () => {
    const t = Template.fromStack(api);
    t.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /health" });
    t.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: Match.stringLikeRegexp("nodejs24"),
      Architectures: ["arm64"],
    });
  });

  it("rejects unknown stages", () => {
    expect(() => getStageConfig("staging")).toThrow();
  });
});
