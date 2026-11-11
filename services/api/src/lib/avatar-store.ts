import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface AvatarStore {
  put(userId: string, bytes: Uint8Array): Promise<string>;
  delete(key: string): Promise<void>;
  /** Short-lived GET URL; the bucket itself is private. */
  urlFor(key: string): Promise<string>;
}

const URL_TTL_SECONDS = 3600;

export class S3AvatarStore implements AvatarStore {
  constructor(
    private readonly bucket: string,
    private readonly s3: S3Client = new S3Client({}),
  ) {}

  async put(userId: string, bytes: Uint8Array) {
    const key = `avatars/${userId}/${randomUUID()}.webp`;
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: "image/webp" }),
    );
    return key;
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  urlFor(key: string) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: URL_TTL_SECONDS,
    });
  }
}
