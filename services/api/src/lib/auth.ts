import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";

export interface Caller {
  userId: string;
  username: string;
}

/** Identity comes from the verified Cognito access token (API Gateway JWT authorizer). */
export function getCaller(event: APIGatewayProxyEventV2WithJWTAuthorizer): Caller {
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const userId = claims.sub;
  const username = claims.username;
  if (typeof userId !== "string" || typeof username !== "string") {
    throw new Error("Missing sub/username claims; is the JWT authorizer attached to this route?");
  }
  return { userId, username };
}
