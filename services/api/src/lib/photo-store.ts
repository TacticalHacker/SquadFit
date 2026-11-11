import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** Food photos live in the private bucket under `food-photos/<sub>/` (feature 005, research R3). */
export type PhotoContentType = "image/jpeg" | "image/webp";

export interface PhotoStore {
  /** Stores the picture and returns its key. */
  put(userId: string, entryId: string, bytes: Uint8Array, contentType: PhotoContentType): Promise<string>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: PhotoContentType } | null>;
  delete(key: string): Promise<void>;
  /** Short-lived GET URL; the bucket itself is private. */
  urlFor(key: string): Promise<string>;
}

export const PHOTO_PREFIX = "food-photos/";
const URL_TTL_SECONDS = 3600;

export const photoKey = (userId: string, entryId: string, contentType: PhotoContentType) =>
  `${PHOTO_PREFIX}${userId}/${entryId}.${contentType === "image/webp" ? "webp" : "jpg"}`;

export class S3PhotoStore implements PhotoStore {
  constructor(
    private readonly bucket: string,
    private readonly s3: S3Client = new S3Client({}),
  ) {}

  async put(userId: string, entryId: string, bytes: Uint8Array, contentType: PhotoContentType) {
    const key = photoKey(userId, entryId, contentType);
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }));
    return key;
  }

  async get(key: string) {
    if (!key.startsWith(PHOTO_PREFIX)) return null;
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) return null;
      return { bytes, contentType: res.ContentType === "image/webp" ? ("image/webp" as const) : ("image/jpeg" as const) };
    } catch (err) {
      if (err instanceof Error && err.name === "NoSuchKey") return null;
      throw err;
    }
  }

  async delete(key: string) {
    if (!key.startsWith(PHOTO_PREFIX)) return;
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  urlFor(key: string) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: URL_TTL_SECONDS });
  }
}
