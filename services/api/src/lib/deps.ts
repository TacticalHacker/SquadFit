import { requireEnv } from "./env";
import { S3AvatarStore, type AvatarStore } from "./avatar-store";
import { DynamoFoodRepo, type FoodRepo } from "./food-repo";
import { DynamoGymRepo, type GymRepo } from "./gym-repo";
import { DynamoWorkoutRepo, type WorkoutRepo } from "./workout-repo";
import { DynamoCoachRepo, type CoachRepo } from "./coach-repo";
import { DynamoCredentialRepo, type CredentialRepo } from "./credential-repo";
import { S3PhotoStore, type PhotoStore } from "./photo-store";
import { DynamoProfileRepo, type ProfileRepo } from "./profile-repo";
import { DynamoWaitlistRepo, type WaitlistRepo } from "./waitlist-repo";
import { DynamoSquadRepo, type SquadRepo } from "./squad-repo";
import { DynamoActivityRepo, type ActivityRepo } from "./activity-repo";
import { DynamoHealthTokenRepo, type HealthTokenRepo } from "./health-token-repo";

export interface Deps {
  profiles: ProfileRepo;
  workouts: WorkoutRepo;
  gym: GymRepo;
  food: FoodRepo;
  coach: CoachRepo;
  credentials: CredentialRepo;
  avatars: AvatarStore;
  photos: PhotoStore;
  waitlist: WaitlistRepo;
  squad: SquadRepo;
  activity: ActivityRepo;
  healthTokens: HealthTokenRepo;
  now: () => Date;
}

let cached: Deps | undefined;

/** Real AWS-backed dependencies, built once per Lambda container. Tests pass fakes to `handle()` directly. */
export function getDeps(): Deps {
  cached ??= {
    profiles: new DynamoProfileRepo(requireEnv("TABLE_NAME")),
    workouts: new DynamoWorkoutRepo(requireEnv("TABLE_NAME")),
    gym: new DynamoGymRepo(requireEnv("TABLE_NAME")),
    food: new DynamoFoodRepo(requireEnv("TABLE_NAME")),
    coach: new DynamoCoachRepo(requireEnv("TABLE_NAME")),
    credentials: new DynamoCredentialRepo(requireEnv("TABLE_NAME")),
    avatars: new S3AvatarStore(requireEnv("AVATAR_BUCKET")),
    photos: new S3PhotoStore(requireEnv("AVATAR_BUCKET")),
    waitlist: new DynamoWaitlistRepo(requireEnv("TABLE_NAME")),
    squad: new DynamoSquadRepo(requireEnv("TABLE_NAME")),
    activity: new DynamoActivityRepo(requireEnv("TABLE_NAME")),
    healthTokens: new DynamoHealthTokenRepo(requireEnv("TABLE_NAME")),
    now: () => new Date(),
  };
  return cached;
}
