export type Stage = "dev" | "prod";

/** Every stage lives in Mumbai. Deploys and the operator CLI never guess a region from the environment. */
export const AWS_REGION = "ap-south-1";

export interface StageConfig {
  stage: Stage;
  /** Keep data on stack deletion. Always true outside dev. */
  retainData: boolean;
}

const configs: Record<Stage, StageConfig> = {
  dev: {
    stage: "dev",
    retainData: false,
  },
  prod: {
    stage: "prod",
    retainData: true,
  },
};

export function getStageConfig(stage: unknown): StageConfig {
  if (stage !== "dev" && stage !== "prod") {
    throw new Error(`Unknown stage "${String(stage)}". Pass -c stage=dev|prod.`);
  }
  return configs[stage];
}
