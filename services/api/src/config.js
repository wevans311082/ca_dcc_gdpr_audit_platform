const required = ['DATABASE_URL', 'REDIS_URL', 'MINIO_ENDPOINT', 'MINIO_BUCKET', 'QDRANT_URL', 'OLLAMA_BASE_URL', 'JWT_SECRET'];

export function loadConfig(environment = process.env) {
  const missing = required.filter((name) => !environment[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  return Object.freeze({
    port: Number(environment.API_PORT || 3000),
    databaseUrl: environment.DATABASE_URL,
    redisUrl: environment.REDIS_URL,
    minioEndpoint: environment.MINIO_ENDPOINT,
    minioBucket: environment.MINIO_BUCKET,
    minioAccessKey: environment.MINIO_ACCESS_KEY || environment.MINIO_ROOT_USER,
    minioSecretKey: environment.MINIO_SECRET_KEY || environment.MINIO_ROOT_PASSWORD,
    qdrantUrl: environment.QDRANT_URL,
    ollamaBaseUrl: environment.OLLAMA_BASE_URL,
    ollamaEmbeddingModel: environment.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
    jwtSecret: environment.JWT_SECRET,
    openAiApiKey: environment.OPENAI_API_KEY || null,
    openAiAnswerModel: environment.OPENAI_ANSWER_MODEL || 'gpt-4.1-mini',
    ragResultLimit: Number(environment.RAG_RESULT_LIMIT || 5),
    ragMinimumScore: Number(environment.RAG_MINIMUM_SCORE || 0.35),
    uploadMaxBytes: Number(environment.UPLOAD_MAX_BYTES || 52_428_800),
    evidencePackageMaxBytes: Number(environment.EVIDENCE_PACKAGE_MAX_BYTES || 524_288_000),
  });
}