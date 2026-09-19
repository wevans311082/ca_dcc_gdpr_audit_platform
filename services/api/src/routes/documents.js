import { createHash } from 'node:crypto';
import { Queue } from 'bullmq';
import { createIngestionJob, createVectorCleanupJob, INGESTION_QUEUE, VECTOR_CLEANUP_QUEUE } from '@ca-dcc/shared';

const allowedDocuments = new Map([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['text/plain', 'txt'],
  ['text/markdown', 'md'],
]);
const editorRoles = new Set(['org_admin', 'assessor']);

function fileExtension(fileName) {
  return fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
}

function normalizeTitle(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return value.trim();
}

function safeDownloadFilename(filename) {
  return filename.replace(/[\\/:*?"<>|\r\n]/g, '_').replace(/^\.+/, '') || 'policy-document';
}

async function requireMembership(request, reply) {
  await request.jwtVerify();
  if (!request.user.organizationId || !request.user.sub) {
    return reply.code(401).send({ error: 'Invalid session.' });
  }
}

function requireEditor(request) {
  if (!editorRoles.has(request.user.role)) throw new Error('Your role cannot modify documents.');
}

export async function documentRoutes(app, { config, database, storage }) {
  const queue = new Queue(INGESTION_QUEUE, { connection: { url: config.redisUrl } });
  const cleanupQueue = new Queue(VECTOR_CLEANUP_QUEUE, { connection: { url: config.redisUrl } });
  app.addHook('onClose', async () => {
    await queue.close();
    await cleanupQueue.close();
  });

  app.get('/api/audits/:auditId/documents', { preHandler: requireMembership }, async (request) => {
    const documents = await database.query(
      `SELECT d.id, d.title, d.document_type, d.status, d.created_at, d.updated_at,
              v.id AS version_id, v.version_number, v.original_filename, v.byte_size, v.created_at AS version_created_at,
              j.status AS ingestion_status, j.error_message
       FROM documents d
       LEFT JOIN document_versions v ON v.document_id = d.id AND v.superseded_at IS NULL
       LEFT JOIN LATERAL (
         SELECT status, error_message FROM ingestion_jobs
         WHERE document_id = d.id AND document_version_id = v.id
         ORDER BY created_at DESC LIMIT 1
       ) j ON true
       WHERE d.audit_id = $1 AND d.organization_id = $2 AND d.deleted_at IS NULL
       ORDER BY d.created_at DESC`,
      [request.params.auditId, request.user.organizationId],
    );
    return { documents: documents.rows };
  });

  app.get('/api/audits/:auditId/documents/:documentId/download', { preHandler: requireMembership }, async (request, reply) => {
    const document = await database.query(
      `SELECT v.object_key, v.original_filename, v.content_type
       FROM documents d JOIN document_versions v ON v.document_id = d.id AND v.superseded_at IS NULL
       WHERE d.id = $1 AND d.audit_id = $2 AND d.organization_id = $3 AND d.deleted_at IS NULL`,
      [request.params.documentId, request.params.auditId, request.user.organizationId],
    );
    if (document.rowCount === 0) return reply.code(404).send({ error: 'Document not found.' });
    try {
      const source = await storage.get(document.rows[0].object_key);
      reply.header('Cache-Control', 'private, no-store');
      reply.header('Content-Type', document.rows[0].content_type);
      reply.header('Content-Disposition', `attachment; filename="${safeDownloadFilename(document.rows[0].original_filename)}"`);
      return reply.send(source.Body);
    } catch (error) {
      request.log.error({ documentId: request.params.documentId, error: error.message }, 'Document download failed.');
      return reply.code(404).send({ error: 'Document not found.' });
    }
  });

  app.post('/api/audits/:auditId/documents', { preHandler: requireMembership }, async (request, reply) => {
    let objectKey;
    try {
      requireEditor(request);
      const upload = await request.file({ limits: { fileSize: config.uploadMaxBytes, files: 1 } });
      if (!upload) return reply.code(400).send({ error: 'A document file is required.' });

      const extension = fileExtension(upload.filename);
      const documentFormat = allowedDocuments.get(upload.mimetype);
      const extensionMatches = documentFormat === extension || (documentFormat === 'md' && extension === 'markdown');
      if (!documentFormat || !extensionMatches) {
        return reply.code(415).send({ error: 'Only PDF, DOCX, TXT, and Markdown documents are supported.' });
      }

      const contents = await upload.toBuffer();
      if (upload.file.truncated) return reply.code(413).send({ error: 'The document exceeds the upload size limit.' });
      const contentHash = createHash('sha256').update(contents).digest('hex');
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        const audit = await client.query(
          'SELECT id FROM audits WHERE id = $1 AND organization_id = $2',
          [request.params.auditId, request.user.organizationId],
        );
        if (audit.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Audit not found.' });
        }

        const document = await client.query(
          `INSERT INTO documents (organization_id, audit_id, title, document_type, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id, title, status`,
          [request.user.organizationId, request.params.auditId, normalizeTitle(upload.fields.title?.value, upload.filename), documentFormat, request.user.sub],
        );
        objectKey = `${request.user.organizationId}/${request.params.auditId}/${document.rows[0].id}/1/${contentHash}`;
        const version = await client.query(
          `INSERT INTO document_versions (document_id, version_number, original_filename, content_type, byte_size, sha256, object_key)
           VALUES ($1, 1, $2, $3, $4, $5, $6) RETURNING id`,
          [document.rows[0].id, upload.filename, upload.mimetype, contents.length, contentHash, objectKey],
        );
        const job = await client.query(
          `INSERT INTO ingestion_jobs (organization_id, audit_id, document_id, document_version_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [request.user.organizationId, request.params.auditId, document.rows[0].id, version.rows[0].id],
        );

        await storage.put({ key: objectKey, body: contents, contentType: upload.mimetype });
        const queuedJob = await queue.add('ingest-document', createIngestionJob({
          organizationId: request.user.organizationId,
          auditId: request.params.auditId,
          documentId: document.rows[0].id,
          documentVersionId: version.rows[0].id,
        }), { jobId: job.rows[0].id, attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
        await client.query('UPDATE ingestion_jobs SET queue_job_id = $1 WHERE id = $2', [queuedJob.id, job.rows[0].id]);
        await client.query('COMMIT');
        return reply.code(201).send({ document: { ...document.rows[0], versionId: version.rows[0].id, jobId: job.rows[0].id } });
      } catch (error) {
        await client.query('ROLLBACK');
        if (objectKey) await storage.remove(objectKey).catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      request.log.error(error, 'Document upload failed.');
      return reply.code(400).send({ error: error.message || 'Unable to upload document.' });
    }
  });

  app.post('/api/audits/:auditId/documents/:documentId/replace', { preHandler: requireMembership }, async (request, reply) => {
    let objectKey;
    let cleanup;
    try {
      requireEditor(request);
      const upload = await request.file({ limits: { fileSize: config.uploadMaxBytes, files: 1 } });
      if (!upload) return reply.code(400).send({ error: 'A replacement document file is required.' });

      const extension = fileExtension(upload.filename);
      const documentFormat = allowedDocuments.get(upload.mimetype);
      const extensionMatches = documentFormat === extension || (documentFormat === 'md' && extension === 'markdown');
      if (!documentFormat || !extensionMatches) {
        return reply.code(415).send({ error: 'Only PDF, DOCX, TXT, and Markdown documents are supported.' });
      }

      const contents = await upload.toBuffer();
      if (upload.file.truncated) return reply.code(413).send({ error: 'The document exceeds the upload size limit.' });
      const contentHash = createHash('sha256').update(contents).digest('hex');
      const client = await database.connect();
      try {
        await client.query('BEGIN');
        const existing = await client.query(
          `SELECT d.id, d.audit_id, v.id AS version_id, v.version_number
           FROM documents d JOIN document_versions v ON v.document_id = d.id AND v.superseded_at IS NULL
           WHERE d.id = $1 AND d.audit_id = $2 AND d.organization_id = $3 AND d.deleted_at IS NULL`,
          [request.params.documentId, request.params.auditId, request.user.organizationId],
        );
        if (existing.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Document not found.' });
        }

        const nextVersionNumber = existing.rows[0].version_number + 1;
        objectKey = `${request.user.organizationId}/${request.params.auditId}/${existing.rows[0].id}/${nextVersionNumber}/${contentHash}`;
        const version = await client.query(
          `INSERT INTO document_versions (document_id, version_number, original_filename, content_type, byte_size, sha256, object_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [existing.rows[0].id, nextVersionNumber, upload.filename, upload.mimetype, contents.length, contentHash, objectKey],
        );
        const job = await client.query(
          `INSERT INTO ingestion_jobs (organization_id, audit_id, document_id, document_version_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [request.user.organizationId, request.params.auditId, existing.rows[0].id, version.rows[0].id],
        );

        await storage.put({ key: objectKey, body: contents, contentType: upload.mimetype });
        const queuedJob = await queue.add('ingest-document', createIngestionJob({
          organizationId: request.user.organizationId,
          auditId: request.params.auditId,
          documentId: existing.rows[0].id,
          documentVersionId: version.rows[0].id,
        }), { jobId: job.rows[0].id, attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
        await client.query('UPDATE ingestion_jobs SET queue_job_id = $1 WHERE id = $2', [queuedJob.id, job.rows[0].id]);
        await client.query('UPDATE document_versions SET superseded_at = now() WHERE id = $1', [existing.rows[0].version_id]);
        await client.query(
          `UPDATE documents SET title = $1, document_type = $2, status = 'queued', updated_at = now() WHERE id = $3`,
          [normalizeTitle(upload.fields.title?.value, upload.filename), documentFormat, existing.rows[0].id],
        );
        await client.query(
          `UPDATE answer_generations SET status = 'stale', invalidated_at = now()
           WHERE audit_id = $1 AND status = 'current'`,
          [request.params.auditId],
        );
        cleanup = await client.query(
          `INSERT INTO vector_cleanup_jobs (organization_id, audit_id, document_id, document_version_id, operation)
           VALUES ($1, $2, $3, $4, 'replace')
           ON CONFLICT DO NOTHING RETURNING id`,
          [request.user.organizationId, request.params.auditId, existing.rows[0].id, existing.rows[0].version_id],
        );
        await client.query('COMMIT');
        if (cleanup.rowCount > 0) {
          await cleanupQueue.add('delete-document-vectors', createVectorCleanupJob({
            organizationId: request.user.organizationId,
            auditId: request.params.auditId,
            documentId: existing.rows[0].id,
            documentVersionId: existing.rows[0].version_id,
          }), { jobId: cleanup.rows[0].id, attempts: 5, backoff: { type: 'exponential', delay: 1000 } })
            .catch((error) => request.log.warn({ cleanupJobId: cleanup.rows[0].id, error: error.message }, 'Vector cleanup will be recovered by the worker.'));
        }
        return reply.code(201).send({ document: { id: existing.rows[0].id, versionId: version.rows[0].id, jobId: job.rows[0].id, status: 'queued' } });
      } catch (error) {
        await client.query('ROLLBACK');
        if (objectKey) await storage.remove(objectKey).catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      request.log.error(error, 'Document replacement failed.');
      return reply.code(400).send({ error: error.message || 'Unable to replace document.' });
    }
  });

  app.post('/api/audits/:auditId/documents/:documentId/retry', { preHandler: requireMembership }, async (request, reply) => {
    try {
      requireEditor(request);
      const document = await database.query(
        `SELECT d.id, v.id AS version_id FROM documents d
         JOIN document_versions v ON v.document_id = d.id AND v.superseded_at IS NULL
         WHERE d.id = $1 AND d.audit_id = $2 AND d.organization_id = $3 AND d.deleted_at IS NULL`,
        [request.params.documentId, request.params.auditId, request.user.organizationId],
      );
      if (document.rowCount === 0) return reply.code(404).send({ error: 'Document not found.' });
      const activeJob = await database.query(
        `SELECT id FROM ingestion_jobs WHERE document_version_id = $1 AND status IN ('queued', 'processing')
         ORDER BY created_at DESC LIMIT 1`,
        [document.rows[0].version_id],
      );
      if (activeJob.rowCount > 0) return reply.code(202).send({ jobId: activeJob.rows[0].id, existing: true });
      const job = await database.query(
        `INSERT INTO ingestion_jobs (organization_id, audit_id, document_id, document_version_id)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [request.user.organizationId, request.params.auditId, document.rows[0].id, document.rows[0].version_id],
      );
      const queuedJob = await queue.add('ingest-document', createIngestionJob({
        organizationId: request.user.organizationId,
        auditId: request.params.auditId,
        documentId: document.rows[0].id,
        documentVersionId: document.rows[0].version_id,
      }), { jobId: job.rows[0].id, attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
      await database.query('UPDATE ingestion_jobs SET queue_job_id = $1 WHERE id = $2', [queuedJob.id, job.rows[0].id]);
      await database.query(
        `UPDATE documents SET status = 'queued', updated_at = now() WHERE id = $1`,
        [document.rows[0].id],
      );
      return reply.code(202).send({ jobId: job.rows[0].id });
    } catch (error) {
      request.log.error(error, 'Document retry failed.');
      return reply.code(400).send({ error: error.message || 'Unable to retry document ingestion.' });
    }
  });

  app.delete('/api/audits/:auditId/documents/:documentId', { preHandler: requireMembership }, async (request, reply) => {
    try {
      requireEditor(request);
      const client = await database.connect();
      let document;
      let cleanup;
      try {
        await client.query('BEGIN');
        document = await client.query(
          `SELECT d.id, v.object_key FROM documents d
           LEFT JOIN document_versions v ON v.document_id = d.id AND v.superseded_at IS NULL
           WHERE d.id = $1 AND d.audit_id = $2 AND d.organization_id = $3 AND d.deleted_at IS NULL`,
          [request.params.documentId, request.params.auditId, request.user.organizationId],
        );
        if (document.rowCount === 0) {
          await client.query('ROLLBACK');
          return reply.code(404).send({ error: 'Document not found.' });
        }
        await client.query(
          `UPDATE documents SET status = 'deleted', deleted_at = now(), updated_at = now() WHERE id = $1`,
          [request.params.documentId],
        );
        await client.query(
          `UPDATE answer_generations SET status = 'stale', invalidated_at = now()
           WHERE audit_id = $1 AND status = 'current'`,
          [request.params.auditId],
        );
        cleanup = await client.query(
          `INSERT INTO vector_cleanup_jobs (organization_id, audit_id, document_id, operation)
           VALUES ($1, $2, $3, 'delete') ON CONFLICT DO NOTHING RETURNING id`,
          [request.user.organizationId, request.params.auditId, request.params.documentId],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      if (cleanup.rowCount > 0) {
        await cleanupQueue.add('delete-document-vectors', createVectorCleanupJob({
          organizationId: request.user.organizationId,
          auditId: request.params.auditId,
          documentId: request.params.documentId,
        }), { jobId: cleanup.rows[0].id, attempts: 5, backoff: { type: 'exponential', delay: 1000 } })
          .catch((error) => request.log.warn({ cleanupJobId: cleanup.rows[0].id, error: error.message }, 'Vector cleanup will be recovered by the worker.'));
      }
      for (const version of document.rows) {
        if (!version.object_key) continue;
        const retainedByPackage = await database.query(
          `SELECT 1 FROM evidence_package_documents epd
           JOIN evidence_packages ep ON ep.id = epd.evidence_package_id
           WHERE epd.source_object_key = $1 AND ep.status IN ('queued', 'building', 'ready', 'failed')
             AND ep.expires_at > now() LIMIT 1`,
          [version.object_key],
        );
        if (retainedByPackage.rowCount === 0) await storage.remove(version.object_key);
      }
      return reply.code(204).send();
    } catch (error) {
      request.log.error(error, 'Document deletion failed.');
      return reply.code(400).send({ error: error.message || 'Unable to delete document.' });
    }
  });
}