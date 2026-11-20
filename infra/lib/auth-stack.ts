import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AccountRecovery, CfnUserPoolGroup, FeaturePlan, UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";
import type { StageConfig } from "./config";

export interface AuthStackProps extends StackProps {
  config: StageConfig;
}

/**
 * Identity: usernames + passwords live in Cognito. There is no public sign-up; the operator
 * creates users with `pnpm admin -- create-user` (spec FR-004, research R1).
 */
export class AuthStack extends Stack {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const { config } = props;

    this.userPool = new UserPool(this, "UserPool", {
      userPoolName: `calci-${config.stage}`,
      featurePlan: FeaturePlan.LITE,
      selfSignUpEnabled: false,
      signInCaseSensitive: false,
      signInAliases: { username: true },
      accountRecovery: AccountRecovery.NONE, // no email/phone on file; the operator resets passwords
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },
      deletionProtection: config.retainData,
      removalPolicy: config.retainData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: false,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      // Sliding 30-day inactivity is enforced by the web app's cookie (research R3);
      // this is the hard upper bound on a refresh token.
      refreshTokenValidity: Duration.days(365),
    });

    // Feature 015: members in this group manage the gym exercise library (`pnpm admin admins add|remove|list`).
    new CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "admin",
      description: "SquadFit admins (feature 015)",
    });

    new CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
  }
}
