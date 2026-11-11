import { requireEnv } from "./env";
import { S3AvatarStore, type AvatarStore } from "./avatar-store";
import { DynamoFoodRepo, type FoodRepo } from "./food-repo";
import { DynamoWorkoutRepo, type WorkoutRepo } from "./workout-repo";
import { DynamoProfileRepo, type ProfileRepo } from "./profile-repo";

export interface Deps {
  profiles: ProfileRepo;
  workouts: WorkoutRepo;
  food: FoodRepo;
  avatars: AvatarStore;
  now: () => Date;
}

let cached: Deps | undefined;

/** Real AWS-backed dependencies, built once per Lambda container. Tests pass fakes to `handle()` directly. */
export function getDeps(): Deps {
  cached ??= {
    profiles: new DynamoProfileRepo(requireEnv("TABLE_NAME")),
    workouts: new DynamoWorkoutRepo(requireEnv("TABLE_NAME")),
    food: new DynamoFoodRepo(requireEnv("TABLE_NAME")),
    avatars: new S3AvatarStore(requireEnv("AVATAR_BUCKET")),
    now: () => new Date(),
  };
  return cached;
}
