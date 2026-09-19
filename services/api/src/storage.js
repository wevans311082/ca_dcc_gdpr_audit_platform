import { CreateBucketCommand, DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export function createDocumentStorage(config) {
  const client = new S3Client({
    endpoint: config.minioEndpoint,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.minioAccessKey,
      secretAccessKey: config.minioSecretKey,
    },
  });
  let bucketReady = false;

  async function ensureBucket() {
    if (bucketReady) return;
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.minioBucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: config.minioBucket }));
    }
    bucketReady = true;
  }

  return {
    async put({ key, body, contentType }) {
      await ensureBucket();
      await client.send(new PutObjectCommand({
        Bucket: config.minioBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.minioBucket, Key: key }));
    },
    async get(key) {
      return client.send(new GetObjectCommand({ Bucket: config.minioBucket, Key: key }));
    },
  };
}