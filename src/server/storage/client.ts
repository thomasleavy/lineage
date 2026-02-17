import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const region = process.env.S3_REGION ?? 'us-east-1';
const bucket = process.env.S3_BUCKET ?? 'lineage-assets';
const useSSL = process.env.S3_USE_SSL === 'true';

export const s3Client = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: process.env.S3_ACCESS_KEY
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      }
    : undefined,
  ...(endpoint.startsWith('https') || useSSL ? {} : { tls: false }),
});

export const S3_BUCKET_NAME = bucket;

let bucketEnsured = false;

async function ensureBucketExists(): Promise<void> {
  if (bucketEnsured) return;
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET_NAME }));
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    const isMissing =
      e?.name === 'NotFound' ||
      e?.name === 'NoSuchBucket' ||
      e?.$metadata?.httpStatusCode === 404;
    if (isMissing) {
      await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET_NAME }));
    } else {
      throw err;
    }
  }
  bucketEnsured = true;
}

export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await ensureBucketExists();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getFromS3(key: string): Promise<Buffer> {
  const res = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key })
  );
  const chunks: Uint8Array[] = [];
  if (!res.Body) throw new Error('Empty S3 body');
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key })
  );
}

export async function getPresignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, cmd, { expiresIn });
}
