const required = [
  'DATABASE_URL', 'REDIS_URL', 'MINIO_ENDPOINT', 'MINIO_BUCKET',
  'QDRANT_URL', 'OLLAMA_BASE_URL',
];

export function loadConfig(environment = process.env) {
  const missing = required.filter((name) => !environment[name]);
  if (missing.length > 0) throw new Error(`Missing required configuration: ${missing.join(', ')}`);

  return Object.freeze({
    databaseUrl: environment.DATABASE_URL,
    redisUrl: environment.REDIS_URL,
    minioEndpoint: environment.MINIO_ENDPOINT,
    minioBucket: environment.MINIO_BUCKET,
    minioAccessKey: environment.MINIO_ACCESS_KEY || environment.MINIO_ROOT_USER,
    minioSecretKey: environment.MINIO_SECRET_KEY || environment.MINIO_ROOT_PASSWORD,
    qdrantUrl: environment.QDRANT_URL.replace(/\/$/, ''),
    ollamaBaseUrl: environment.OLLAMA_BASE_URL.replace(/\/$/, ''),
    ollamaEmbeddingModel: environment.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  });
}