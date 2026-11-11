export type Stage = "dev" | "prod";

export interface StageConfig {
  stage: Stage;
  /** Browser origins allowed to call the API (the Vercel deployment URLs). */
  allowedOrigins: string[];
  /** Keep data on stack deletion. Always true outside dev. */
  retainData: boolean;
}

const configs: Record<Stage, StageConfig> = {
  dev: {
    stage: "dev",
    allowedOrigins: ["http://localhost:3000", "https://*.vercel.app"],
    retainData: false,
  },
  prod: {
    stage: "prod",
    // TODO: replace with the production Vercel domain once known.
    allowedOrigins: ["https://squadfit.vercel.app"],
    retainData: true,
  },
};

export function getStageConfig(stage: unknown): StageConfig {
  if (stage !== "dev" && stage !== "prod") {
    throw new Error(`Unknown stage "${String(stage)}". Pass -c stage=dev|prod.`);
  }
  return configs[stage];
}
