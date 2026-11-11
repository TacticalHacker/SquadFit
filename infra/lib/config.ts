export type Stage = "dev" | "prod";

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
