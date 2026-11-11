import type { APIGatewayProxyEventV2, Context, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "@calci/shared";
import { handler } from "../src/handlers/health";

describe("GET /health", () => {
  it("returns a payload matching the shared contract", async () => {
    const res = (await handler(
      {} as APIGatewayProxyEventV2,
      {} as Context,
      () => undefined,
    )) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(200);
    expect(HealthResponseSchema.safeParse(JSON.parse(res.body ?? "")).success).toBe(true);
  });
});
