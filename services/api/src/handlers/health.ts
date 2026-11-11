import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type { HealthResponse } from "@calci/shared";
import { json } from "../lib/http";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  const body: HealthResponse = {
    status: "ok",
    stage: process.env.STAGE ?? "local",
    time: new Date().toISOString(),
  };
  return json(200, body);
};
