import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { StageConfig } from "./config";

export interface DataStackProps extends StackProps {
  config: StageConfig;
}

/**
 * Single-table DynamoDB design. Entity key patterns are defined per feature in
 * specs/<feature>/data-model.md during /speckit-plan.
 */
export class DataStack extends Stack {
  readonly table: TableV2;
  /** Private bucket for avatars (256px WebP). Served through short-lived presigned URLs. */
  readonly avatarBucket: Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.table = new TableV2(this, "Table", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billing: Billing.onDemand(),
      // Expires AI-key rate-limit counters (feature 004).
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.config.retainData },
      deletionProtection: props.config.retainData,
      removalPolicy: props.config.retainData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      globalSecondaryIndexes: [
        {
          indexName: "gsi1",
          partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
          sortKey: { name: "gsi1sk", type: AttributeType.STRING },
        },
      ],
    });

    new CfnOutput(this, "TableName", { value: this.table.tableName });

    this.avatarBucket = new Bucket(this, "AvatarBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.config.retainData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.config.retainData,
    });
  }
}
