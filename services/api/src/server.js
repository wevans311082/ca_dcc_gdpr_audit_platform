import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import IORedis from 'ioredis';
import { loadConfig } from './config.js';
import { createDatabase } from './database.js';
import { authRoutes } from './routes/auth.js';
import { auditRoutes } from './routes/audits.js';
import { documentRoutes } from './routes/documents.js';
import { evidencePackageRoutes } from './routes/evidencePackages.js';
import { adminRoutes } from './routes/admin.js';
import { openApiDocument } from './openapi.js';
import { createDocumentStorage } from './storage.js';

async function probe(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
  if (!response.ok) throw new Error(`Dependency returned ${response.status}.`);
}

export async function buildServer(config, database) {
  const app = Fastify({ logger: true, bodyLimit: config.uploadMaxBytes });
  const redis = new IORedis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  redis.on('error', () => {});
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(multipart, { limits: { fileSize: config.uploadMaxBytes, files: 1 } });
  app.addHook('onClose', async () => redis.quit());

  app.get('/api/health', async () => ({ status: 'ok', service: 'audit-api' }));
  app.get('/api/openapi.json', async () => openApiDocument);
  app.get('/api/ready', async (request, reply) => {
    const checks = await Promise.allSettled([
      database.query('SELECT 1'),
      redis.ping(),
      probe(`${config.qdrantUrl.replace(/\/$/, '')}/healthz`),
      probe(`${config.ollamaBaseUrl.replace(/\/$/, '')}/api/tags`),
    ]);
    const dependencies = ['postgres', 'redis', 'qdrant', 'ollama'].map((name, index) => ({
      name,
      ready: checks[index].status === 'fulfilled',
    }));
    const ready = dependencies.every((dependency) => dependency.ready);
    return reply.code(ready ? 200 : 503).send({
      status: ready ? 'ready' : 'degraded',
      dependencies,
      embeddingModel: config.ollamaEmbeddingModel,
      openAiConfigured: Boolean(config.openAiApiKey),
      answerModel: config.openAiAnswerModel,
    });
  });
  await app.register(authRoutes, { database });
  await app.register(auditRoutes, { config, database });
  await app.register(documentRoutes, { config, database, storage: createDocumentStorage(config) });
  await app.register(evidencePackageRoutes, { config, database, storage: createDocumentStorage(config) });
  await app.register(adminRoutes, { config, database, storage: createDocumentStorage(config) });

  return app;
}

const config = loadConfig();
const database = createDatabase(config.databaseUrl);
const app = await buildServer(config, database);

app.listen({ port: config.port, host: '0.0.0.0' })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });

process.on('SIGTERM', async () => {
  await app.close();
  await database.end();
  process.exit(0);
});