import { createHash } from 'node:crypto';
import { PassThrough, Transform } from 'node:stream';
import archiver from 'archiver';
import { Queue, Worker } from 'bullmq';
import { createEvidencePackageJob, createIngestionJob, createVectorCleanupJob, deleteDocumentVectors, EVIDENCE_PACKAGE_QUEUE, INGESTION_QUEUE, VECTOR_CLEANUP_QUEUE } from '@ca-dcc/shared';
import pg from 'pg';
import { chunkParsedSections } from './chunking.js';
import { loadConfig } from './config.js';
import { embedTexts, indexChunks } from './indexer.js';
import { parseDocument } from './parser.js';
import { createDocumentStorage } from './storage.js';

const { Pool } = pg;
const config = loadConfig();
const database = new Pool({ connectionString: config.databaseUrl });
const storage = createDocumentStorage(config);
const cleanupQueue = new Queue(VECTOR_CLEANUP_QUEUE, { connection: { url: config.redisUrl } });
const evidencePackageQueue = new Queue(EVIDENCE_PACKAGE_QUEUE, { connection: { url: config.redisUrl } });

function errorCategory(error) {
  const message = error.message || '';
  if (message.includes('Qdrant')) return 'qdrant';
  if (message.includes('Ollama')) return 'embedding';
  if (message.includes('Unsupported document') || message.includes('password') || message.includes('PDF')) return 'parsing';
  if (message.includes('S3') || message.includes('NoSuchKey')) return 'storage';
  return 'database';
}

const worker = new Worker(INGESTION_QUEUE, async (job) => {
  const { organizationId, auditId, documentId, documentVersionId } = job.data;
  try {
    const version = await database.query(
      `SELECT v.object_key, v.content_type FROM document_versions v
       JOIN documents d ON d.id = v.document_id
       WHERE v.id = $1 AND d.id = $2 AND d.audit_id = $3 AND d.organization_id = $4 AND d.deleted_at IS NULL`,
      [documentVersionId, documentId, auditId, organizationId],
    );
    if (version.rowCount === 0) throw new Error('Document version is no longer available for ingestion.');

    await database.query(
      `UPDATE ingestion_jobs SET status = 'processing', started_at = now(), updated_at = now() WHERE id = $1`,
      [job.id],
    );
    await database.query(`UPDATE documents SET status = 'processing', updated_at = now() WHERE id = $1`, [documentId]);

    const sections = await parseDocument({
      contents: await storage.getBytes(version.rows[0].object_key),
      contentType: version.rows[0].content_type,
    });
    const parsedChunks = chunkParsedSections(sections);
    if (parsedChunks.length === 0) {
      await database.query(`UPDATE ingestion_jobs SET status = 'unsupported', completed_at = now(), updated_at = now() WHERE id = $1`, [job.id]);
      await database.query(`UPDATE documents SET status = 'unsupported', updated_at = now() WHERE id = $1`, [documentId]);
      return;
    }

    await deleteDocumentVectors(config.qdrantUrl, createIngestionJob({ organizationId, auditId, documentId, documentVersionId }));
    await database.query('DELETE FROM document_chunks WHERE document_version_id = $1', [documentVersionId]);
    const indexedChunks = [];
    for (const [chunkIndex, chunk] of parsedChunks.entries()) {
      const inserted = await database.query(
        `INSERT INTO document_chunks (organization_id, audit_id, document_version_id, chunk_index, content_hash, content, page_number, section_heading, source_start, source_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [organizationId, auditId, documentVersionId, chunkIndex, chunk.contentHash, chunk.content, chunk.pageNumber, chunk.sectionHeading, chunk.sourceStart, chunk.sourceEnd],
      );
      indexedChunks.push({ ...chunk, id: inserted.rows[0].id, organizationId, auditId, documentId, documentVersionId });
    }
    await indexChunks(config, indexedChunks, await embedTexts(config, indexedChunks.map((chunk) => chunk.content)));
    await database.query(`UPDATE ingestion_jobs SET status = 'indexed', completed_at = now(), updated_at = now() WHERE id = $1`, [job.id]);
    await database.query(`UPDATE documents SET status = 'indexed', updated_at = now() WHERE id = $1`, [documentId]);
    console.info({ jobId: job.id, documentId, documentVersionId, chunkCount: indexedChunks.length }, 'Document ingestion completed.');
  } catch (error) {
    await database.query(
      `UPDATE ingestion_jobs SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1`,
      [job.id, error.message],
    );
    await database.query(`UPDATE documents SET status = 'failed', updated_at = now() WHERE id = $1`, [documentId]);
    console.error({ jobId: job.id, documentId, documentVersionId, errorCategory: errorCategory(error), error: error.message }, 'Document ingestion failed.');
    throw error;
  }
}, { connection: { url: config.redisUrl } });

const cleanupWorker = new Worker(VECTOR_CLEANUP_QUEUE, async (job) => {
  const cleanup = createVectorCleanupJob(job.data);
  await database.query(
    `UPDATE vector_cleanup_jobs SET status = 'processing', attempts = attempts + 1, updated_at = now() WHERE id = $1`,
    [job.id],
  );
  try {
    await deleteDocumentVectors(config.qdrantUrl, cleanup);
    await database.query(
      `UPDATE vector_cleanup_jobs SET status = 'completed', completed_at = now(), error_message = NULL, updated_at = now() WHERE id = $1`,
      [job.id],
    );
    console.info({ cleanupJobId: job.id, documentId: cleanup.documentId, documentVersionId: cleanup.documentVersionId }, 'Vector cleanup completed.');
  } catch (error) {
    await database.query(
      `UPDATE vector_cleanup_jobs SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1`,
      [job.id, error.message],
    );
    throw error;
  }
}, { connection: { url: config.redisUrl } });

function safeArchiveFilename(filename) {
  return filename.replace(/[\\/:*?"<>|\r\n]/g, '_').replace(/^\.+/, '') || 'policy-document';
}

function createIntegrityVerifier(expectedBytes, expectedHash) {
  const hash = createHash('sha256');
  let byteSize = 0;
  let resolveVerification;
  let rejectVerification;
  const verified = new Promise((resolve, reject) => {
    resolveVerification = resolve;
    rejectVerification = reject;
  });
  const transform = new Transform({
    transform(chunk, encoding, callback) {
      byteSize += chunk.length;
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  transform.on('end', () => {
    const actualHash = hash.digest('hex');
    if (byteSize !== Number(expectedBytes) || actualHash !== expectedHash) {
      rejectVerification(new Error('Snapshotted document integrity check failed.'));
      return;
    }
    resolveVerification();
  });
  transform.on('error', rejectVerification);
  return { transform, verified };
}

const evidencePackageWorker = new Worker(EVIDENCE_PACKAGE_QUEUE, async (job) => {
  const { organizationId, auditId, evidencePackageId } = createEvidencePackageJob(job.data);
  let packageObjectKey;
  try {
    const evidencePackage = await database.query(
      `SELECT id, report_manifest, status FROM evidence_packages
       WHERE id = $1 AND organization_id = $2 AND audit_id = $3 AND status IN ('queued', 'failed') AND expires_at > now()`,
      [evidencePackageId, organizationId, auditId],
    );
    if (evidencePackage.rowCount === 0) return;
    await database.query(
      `UPDATE evidence_packages SET status = 'building', error_message = NULL WHERE id = $1`,
      [evidencePackageId],
    );
    const documents = await database.query(
      `SELECT original_filename, byte_size, sha256, source_object_key
       FROM evidence_package_documents WHERE evidence_package_id = $1 ORDER BY original_filename, document_version_id`,
      [evidencePackageId],
    );
    packageObjectKey = `${organizationId}/${auditId}/evidence-packages/${evidencePackageId}.zip`;
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = new PassThrough();
    let packageByteSize = 0;
    output.on('data', (chunk) => { packageByteSize += chunk.length; });
    archive.pipe(output);
    const upload = storage.put({ key: packageObjectKey, body: output, contentType: 'application/zip' });
    archive.append(JSON.stringify(evidencePackage.rows[0].report_manifest, null, 2), { name: 'report.json' });
    const verifications = [];
    for (const [index, document] of documents.rows.entries()) {
      const source = await storage.get(document.source_object_key);
      const { transform, verified } = createIntegrityVerifier(document.byte_size, document.sha256);
      source.Body.pipe(transform);
      archive.append(transform, { name: `documents/${String(index + 1).padStart(3, '0')}-${safeArchiveFilename(document.original_filename)}` });
      verifications.push(verified);
    }
    await archive.finalize();
    await Promise.all(verifications);
    await upload;
    const ready = await database.query(
       `UPDATE evidence_packages SET status = 'ready', package_object_key = $2, package_byte_size = $3,
         completed_at = now(), error_message = NULL WHERE id = $1 AND status = 'building' AND expires_at > now()`,
      [evidencePackageId, packageObjectKey, packageByteSize],
    );
    if (ready.rowCount === 0) {
      await storage.remove(packageObjectKey).catch(() => undefined);
      return;
    }
    await database.query(
      `INSERT INTO audit_events (organization_id, audit_id, event_type, event_data)
       VALUES ($1, $2, 'evidence_package_ready', $3)`,
      [organizationId, auditId, JSON.stringify({ evidencePackageId, documentCount: documents.rowCount, packageByteSize })],
    );
  } catch (error) {
    if (packageObjectKey) await storage.remove(packageObjectKey).catch(() => undefined);
    await database.query(
      `UPDATE evidence_packages SET status = 'failed', error_message = $2 WHERE id = $1`,
      [evidencePackageId, error.message],
    );
    await database.query(
      `INSERT INTO audit_events (organization_id, audit_id, event_type, event_data)
       VALUES ($1, $2, 'evidence_package_failed', $3)`,
      [organizationId, auditId, JSON.stringify({ evidencePackageId })],
    ).catch(() => undefined);
    throw error;
  }
}, { connection: { url: config.redisUrl } });

async function enqueuePendingVectorCleanup() {
  const pending = await database.query(
    `SELECT id, organization_id, audit_id, document_id, document_version_id
     FROM vector_cleanup_jobs WHERE status IN ('queued', 'failed') ORDER BY created_at LIMIT 50`,
  );
  for (const cleanup of pending.rows) {
    const existingJob = await cleanupQueue.getJob(cleanup.id);
    if (existingJob) {
      if (await existingJob.getState() === 'failed') await existingJob.retry();
      continue;
    }
    await cleanupQueue.add('delete-document-vectors', createVectorCleanupJob({
      organizationId: cleanup.organization_id,
      auditId: cleanup.audit_id,
      documentId: cleanup.document_id,
      documentVersionId: cleanup.document_version_id,
    }), { jobId: cleanup.id, attempts: 5, backoff: { type: 'exponential', delay: 1000 } });
  }
}

async function recoverEvidencePackages() {
  const pending = await database.query(
    `SELECT id, organization_id, audit_id FROM evidence_packages
     WHERE status IN ('queued', 'failed') AND expires_at > now() ORDER BY requested_at LIMIT 20`,
  );
  for (const evidencePackage of pending.rows) {
    const existingJob = await evidencePackageQueue.getJob(evidencePackage.id);
    if (existingJob) {
      if (await existingJob.getState() === 'failed') await existingJob.retry();
      continue;
    }
    await evidencePackageQueue.add('build-evidence-package', createEvidencePackageJob({
      organizationId: evidencePackage.organization_id, auditId: evidencePackage.audit_id, evidencePackageId: evidencePackage.id,
    }), { jobId: evidencePackage.id, attempts: 3, backoff: { type: 'exponential', delay: 1_000 } });
  }
}

async function expireEvidencePackages() {
  const expired = await database.query(
    `UPDATE evidence_packages SET status = 'expired', expired_at = now()
     WHERE status IN ('queued', 'building', 'ready', 'failed') AND expires_at <= now()
     RETURNING id, package_object_key`,
  );
  for (const evidencePackage of expired.rows) {
    if (evidencePackage.package_object_key) await storage.remove(evidencePackage.package_object_key).catch(() => undefined);
  }
  const obsoleteSources = await database.query(
    `SELECT DISTINCT v.object_key FROM document_versions v
     JOIN documents d ON d.id = v.document_id
     LEFT JOIN evidence_package_documents epd ON epd.source_object_key = v.object_key
     LEFT JOIN evidence_packages ep ON ep.id = epd.evidence_package_id AND ep.expires_at > now()
    WHERE (d.deleted_at IS NOT NULL OR v.superseded_at IS NOT NULL) AND ep.id IS NULL`,
  );
  for (const source of obsoleteSources.rows) await storage.remove(source.object_key).catch(() => undefined);
}

const cleanupRecoveryTimer = setInterval(() => {
  enqueuePendingVectorCleanup().catch((error) => console.error({ error: error.message }, 'Vector cleanup recovery failed.'));
}, 30_000);
const evidencePackageRecoveryTimer = setInterval(() => {
  recoverEvidencePackages().catch((error) => console.error({ error: error.message }, 'Evidence package recovery failed.'));
  expireEvidencePackages().catch((error) => console.error({ error: error.message }, 'Evidence package expiry failed.'));
}, 30_000);
enqueuePendingVectorCleanup().catch((error) => console.error({ error: error.message }, 'Initial vector cleanup recovery failed.'));
recoverEvidencePackages().catch((error) => console.error({ error: error.message }, 'Initial evidence package recovery failed.'));
expireEvidencePackages().catch((error) => console.error({ error: error.message }, 'Initial evidence package expiry failed.'));

worker.on('failed', (job, error) => {
  console.error({ jobId: job?.id, error }, 'Document ingestion job failed.');
});

process.on('SIGTERM', async () => {
  clearInterval(cleanupRecoveryTimer);
  clearInterval(evidencePackageRecoveryTimer);
  await worker.close();
  await cleanupWorker.close();
  await evidencePackageWorker.close();
  await cleanupQueue.close();
  await evidencePackageQueue.close();
  await database.end();
  process.exit(0);
});