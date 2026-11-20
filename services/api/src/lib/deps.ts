import { requireEnv } from "./env";
import { S3AvatarStore, type AvatarStore } from "./avatar-store";
import { DynamoFoodRepo, type FoodRepo } from "./food-repo";
import { DynamoGymRepo, type GymRepo } from "./gym-repo";
import { DynamoWorkoutRepo, type WorkoutRepo } from "./workout-repo";
import { DynamoCoachRepo, type CoachRepo } from "./coach-repo";
import { DynamoCredentialRepo, type CredentialRepo } from "./credential-repo";
import { S3PhotoStore, type PhotoStore } from "./photo-store";
import { S3SharePhotoStore, type SharePhotoStore } from "./share-photo-store";
import { DynamoProfileRepo, type ProfileRepo } from "./profile-repo";
import { DynamoWaitlistRepo, type WaitlistRepo } from "./waitlist-repo";
import { DynamoSquadRepo, type SquadRepo } from "./squad-repo";
import { DynamoActivityRepo, type ActivityRepo } from "./activity-repo";
import { DynamoHealthTokenRepo, type HealthTokenRepo } from "./health-token-repo";
import { DynamoCatalogRepo, type CatalogRepo } from "./catalog-repo";
import { CognitoUserDirectory, type UserDirectory } from "./user-directory";

export interface Deps {
  profiles: ProfileRepo;
  workouts: WorkoutRepo;
  gym: GymRepo;
  food: FoodRepo;
  coach: CoachRepo;
  credentials: CredentialRepo;
  avatars: AvatarStore;
  photos: PhotoStore;
  /** Feature 016: photos posted with a workout day (`share-photos/`). */
  sharePhotos: SharePhotoStore;
  waitlist: WaitlistRepo;
  squad: SquadRepo;
  activity: ActivityRepo;
  healthTokens: HealthTokenRepo;
  /** Feature 015: admin-managed gym exercises. Read through `getLibrary`, not directly, except in admin handlers. */
  catalog: CatalogRepo;
  /** Feature 015 Story 5: only the admin-user-post function has USER_POOL_ID and the Cognito permission. */
  users: UserDirectory;
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
    sharePhotos: new S3SharePhotoStore(requireEnv("AVATAR_BUCKET")),
    waitlist: new DynamoWaitlistRepo(requireEnv("TABLE_NAME")),
    squad: new DynamoSquadRepo(requireEnv("TABLE_NAME")),
    activity: new DynamoActivityRepo(requireEnv("TABLE_NAME")),
    healthTokens: new DynamoHealthTokenRepo(requireEnv("TABLE_NAME")),
    catalog: new DynamoCatalogRepo(requireEnv("TABLE_NAME")),
    // Lazy: every other function has no USER_POOL_ID and never touches it.
    users: { create: (u, p) => new CognitoUserDirectory(requireEnv("USER_POOL_ID")).create(u, p) },
    now: () => new Date(),
  };
  return cached;
}
