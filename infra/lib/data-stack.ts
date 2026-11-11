import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AttributeType, Billing, TableV2 } from "aws-cdk-lib/aws-dynamodb";
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

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    this.table = new TableV2(this, "Table", {
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      billing: Billing.onDemand(),
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
  }
}
