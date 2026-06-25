import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { extname } from "path";

// Map common image content-types to a file extension for the S3 key.
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};
const MAX_REMOTE_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB safety cap

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: config.get<string>("AWS_REGION"),
      credentials: {
        accessKeyId: config.get<string>("AWS_ACCESS_KEY_ID"),
        secretAccessKey: config.get<string>("AWS_SECRET_ACCESS_KEY"),
      },
    });
    this.bucket = config.get<string>("AWS_S3_BUCKET");
  }

  /**
   * Upload a file buffer to S3 under the given folder.
   * Returns the S3 object key — store this in the database.
   * Key format: `restaurant/logo-<timestamp>-<random>.<ext>`
   */
  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const ext = extname(file.originalname);
    const key = `${folder}/${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    return key;
  }

  /**
   * Download a remote image (http/https) and store it in S3.
   * Returns the new S3 object key. Throws if the URL isn't a reachable image.
   */
  async uploadFromUrl(url: string, folder: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`fetch ${url} failed: HTTP ${res.status}`);
    }
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim();
    if (contentType && !contentType.startsWith("image/")) {
      throw new Error(`not an image: ${contentType}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) throw new Error("empty body");
    if (buffer.length > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error(`image too large: ${buffer.length} bytes`);
    }
    const ext =
      EXT_BY_TYPE[contentType] ||
      extname(new URL(url).pathname).toLowerCase() ||
      ".jpg";
    const key = `${folder}/url-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || "image/jpeg",
      }),
    );
    return key;
  }

  /**
   * Normalize an image field to an S3 key. If `value` is an external URL it is
   * downloaded into S3 and the new key is returned; if it's already an S3 key
   * (or empty) it's returned unchanged. Best-effort: on download failure the
   * original value is returned so callers never break on a bad URL.
   */
  async ensureUploaded<T extends string | null | undefined>(
    value: T,
    folder: string,
  ): Promise<T | string> {
    if (!value || !/^https?:\/\//i.test(value)) return value;
    // Already an object in our bucket (e.g. a presigned URL from AI generation)?
    // Use its key directly — no re-download, and it fixes the 1-hour expiry.
    const ownKey = this.extractOwnKey(value);
    if (ownKey) return ownKey;
    try {
      return await this.uploadFromUrl(value, folder);
    } catch (err) {
      this.logger.warn(`ensureUploaded fell back to external URL: ${String(err)}`);
      return value;
    }
  }

  /** If the URL points at our own S3 bucket, return its object key; else null. */
  private extractOwnKey(url: string): string | null {
    try {
      const u = new URL(url);
      if (!/(^|\.)amazonaws\.com$/i.test(u.hostname)) return null;
      const path = decodeURIComponent(u.pathname.replace(/^\//, ""));
      // virtual-hosted style: <bucket>.s3.<region>.amazonaws.com/<key>
      if (u.hostname.startsWith(`${this.bucket}.`)) return path || null;
      // path-style: s3.<region>.amazonaws.com/<bucket>/<key>
      if (path.startsWith(`${this.bucket}/`)) {
        return path.slice(this.bucket.length + 1) || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a temporary pre-signed URL for a private S3 object.
   * Default expiry: 1 hour (3600 s). Pass a shorter value for sensitive docs.
   */
  async presignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  /** Delete an object. No-op if the key is missing or the object doesn't exist. */
  async delete(key: string): Promise<void> {
    if (!key) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Return a ready-to-use URL for an imageUrl field.
   * - external URLs (http/https): return as-is — tolerates legacy rows.
   * - S3 keys: generate a presigned URL.
   */
  async resolveImageUrl(
    value: string | null | undefined,
    expiresIn = 3600,
  ): Promise<string | null> {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return this.presignedUrl(value, expiresIn);
  }
}
