import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: config.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucket = config.get<string>('AWS_S3_BUCKET');
  }

  async upload(file: Express.Multer.File, folder: string): Promise<string> {
    const ext = extname(file.originalname);
    const key = `${folder}/${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: file.buffer, ContentType: file.mimetype }),
    );
    return key;
  }

  async presignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }
}
