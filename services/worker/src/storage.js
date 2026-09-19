import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

  return {
    async get(key) {
      return client.send(new GetObjectCommand({ Bucket: config.minioBucket, Key: key }));
    },
    async getBytes(key) {
      const response = await this.get(key);
      return Buffer.from(await response.Body.transformToByteArray());
    },
    async put({ key, body, contentType }) {
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
  };
}