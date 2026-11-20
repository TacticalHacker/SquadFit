import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PhotoContentType } from "./photo-store";

/**
 * Feature 016: the photo a member chose to post with a workout day, under `share-photos/<sub>/` in the private bucket.
 * Only signed-in members see it, through 1-hour links. Never log keys or bytes.
 */
export interface SharePhotoStore {
  put(userId: string, date: string, bytes: Uint8Array, contentType: PhotoContentType): Promise<string>;
  delete(key: string): Promise<void>;
  urlFor(key: string): Promise<string>;
}

export const SHARE_PHOTO_PREFIX = "share-photos/";
const URL_TTL_SECONDS = 3600;

export const sharePhotoKey = (userId: string, date: string, contentType: PhotoContentType) =>
  `${SHARE_PHOTO_PREFIX}${userId}/${date}.${contentType === "image/webp" ? "webp" : "jpg"}`;

export class S3SharePhotoStore implements SharePhotoStore {
  constructor(
    private readonly bucket: string,
    private readonly s3: S3Client = new S3Client({}),
  ) {}

  async put(userId: string, date: string, bytes: Uint8Array, contentType: PhotoContentType) {
    const key = sharePhotoKey(userId, date, contentType);
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType }));
    return key;
  }

  async delete(key: string) {
    if (!key.startsWith(SHARE_PHOTO_PREFIX)) return;
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  urlFor(key: string) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: URL_TTL_SECONDS });
  }
}
