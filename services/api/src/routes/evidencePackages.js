import { Queue } from 'bullmq';
import { createEvidencePackageJob, EVIDENCE_PACKAGE_QUEUE } from '@ca-dcc/shared';
import { getCorpusVersion, getLatestAnswers } from '../ragService.js';
import { createMembershipGuard } from '../routeAuth.js';

function safeDownloadFilename(filename) {
  return filename.replace(/[\\/:*?"<>|\r\n]/g, '_').replace(/^\.+/, '') || 'audit-evidence-package.zip';
}

async function buildReportManifest(database, organizationId, auditId) {
  const [audit, assessments, corpusVersion] = await Promise.all([
    database.query(
      `SELECT id, title, selected_level, question_catalogue_version, status, scope, created_at, updated_at
       FROM audits WHERE id = $1 AND organization_id = $2`,
      [auditId, organizationId],
    ),
    database.query(
      `SELECT question_id, status, response, notes, evidence_checklist, updated_at
       FROM assessments WHERE audit_id = $1 ORDER BY question_id`,
      [auditId],
    ),
    getCorpusVersion(database, organizationId, auditId),
  ]);
  if (audit.rowCount === 0) return null;
  const referencedAnswers = await getLatestAnswers(database, organizationId, auditId, corpusVersion);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    audit: audit.rows[0],
    assessments: assessments.rows,
    referencedAnswers,
  };
}

function packageSummary(row) {
  return {
    id: row.id,
    status: row.status,
    sourceDocumentCount: row.source_document_count,
    sourceByteSize: Number(row.source_byte_size),
    packageByteSize: row.package_byte_size === null ? null : Number(row.package_byte_size),
    errorMessage: row.error_message,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
    expiresAt: row.expires_at,
    expiredAt: row.expired_at,
  };
}

export async function evidencePackageRoutes(app, { config, database, storage }) {
  const requireMembership = createMembershipGuard(database);
  const queue = new Queue(EVIDENCE_PACKAGE_QUEUE, { connection: { url: config.redisUrl } });
  app.addHook('onClose', async () => queue.close());

  app.post('/api/audits/:auditId/evidence-packages', { preHandler: requireMembership }, async (request, reply) => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const audit = await client.query(
        'SELECT id FROM audits WHERE id = $1 AND organization_id = $2 FOR SHARE',
        [request.params.auditId, request.user.organizationId],
      );
      if (audit.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Audit not found.' });
      }
      const documents = await client.query(
        `SELECT d.id AS document_id, d.title, v.id AS document_version_id, v.original_filename, v.content_type,
                v.byte_size, v.sha256, v.object_key
         FROM documents d
         JOIN document_versions v ON v.document_id = d.id AND v.superseded_at IS NULL
         WHERE d.organization_id = $1 AND d.audit_id = $2 AND d.deleted_at IS NULL
         ORDER BY d.created_at, v.version_number FOR SHARE OF d, v`,
        [request.user.organizationId, request.params.auditId],
      );
      const sourceByteSize = documents.rows.reduce((total, document) => total + Number(document.byte_size), 0);
      if (documents.rowCount === 0) throw new Error('Add at least one active document before preparing an evidence package.');
      if (sourceByteSize > config.evidencePackageMaxBytes) {
        throw new Error(`Evidence package source documents exceed the ${Math.floor(config.evidencePackageMaxBytes / 1_048_576)} MB limit.`);
      }
      const manifest = await buildReportManifest(client, request.user.organizationId, request.params.auditId);
      manifest.documentInventory = documents.rows.map(({ document_id, document_version_id, title, original_filename, content_type, byte_size, sha256 }) => ({
        documentId: document_id, documentVersionId: document_version_id, title, originalFilename: original_filename,
        contentType: content_type, byteSize: Number(byte_size), sha256,
      }));
      const evidencePackage = await client.query(
        `INSERT INTO evidence_packages (organization_id, audit_id, created_by, report_manifest, source_document_count, source_byte_size, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, now() + interval '7 days') RETURNING *`,
        [request.user.organizationId, request.params.auditId, request.user.sub, JSON.stringify(manifest), documents.rowCount, sourceByteSize],
      );
      for (const document of documents.rows) {
        await client.query(
          `INSERT INTO evidence_package_documents
           (evidence_package_id, document_id, document_version_id, title, original_filename, content_type, byte_size, sha256, source_object_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [evidencePackage.rows[0].id, document.document_id, document.document_version_id, document.title,
            document.original_filename, document.content_type, document.byte_size, document.sha256, document.object_key],
        );
      }
      await client.query(
        `INSERT INTO audit_events (organization_id, audit_id, actor_id, event_type, event_data)
         VALUES ($1, $2, $3, 'evidence_package_requested', $4)`,
        [request.user.organizationId, request.params.auditId, request.user.sub, JSON.stringify({ evidencePackageId: evidencePackage.rows[0].id, documentCount: documents.rowCount, sourceByteSize })],
      );
      await client.query('COMMIT');
      const queuedJob = await queue.add('build-evidence-package', createEvidencePackageJob({
        organizationId: request.user.organizationId, auditId: request.params.auditId, evidencePackageId: evidencePackage.rows[0].id,
      }), { jobId: evidencePackage.rows[0].id, attempts: 3, backoff: { type: 'exponential', delay: 1_000 } });
      await database.query('UPDATE evidence_packages SET queue_job_id = $1 WHERE id = $2', [queuedJob.id, evidencePackage.rows[0].id]);
      return reply.code(202).send({ evidencePackage: packageSummary(evidencePackage.rows[0]) });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      request.log.error({ error: error.message, auditId: request.params.auditId }, 'Evidence package request failed.');
      return reply.code(400).send({ error: error.message || 'Unable to prepare the evidence package.' });
    } finally {
      client.release();
    }
  });

  app.get('/api/audits/:auditId/evidence-packages', { preHandler: requireMembership }, async (request) => {
    const packages = await database.query(
      `SELECT * FROM evidence_packages WHERE organization_id = $1 AND audit_id = $2 ORDER BY requested_at DESC`,
      [request.user.organizationId, request.params.auditId],
    );
    return { evidencePackages: packages.rows.map(packageSummary) };
  });

  app.get('/api/audits/:auditId/evidence-packages/:packageId/download', { preHandler: requireMembership }, async (request, reply) => {
    const evidencePackage = await database.query(
      `SELECT id, package_object_key FROM evidence_packages
       WHERE id = $1 AND audit_id = $2 AND organization_id = $3 AND status = 'ready' AND expires_at > now()`,
      [request.params.packageId, request.params.auditId, request.user.organizationId],
    );
    if (evidencePackage.rowCount === 0) return reply.code(404).send({ error: 'Evidence package not found.' });
    try {
      const source = await storage.get(evidencePackage.rows[0].package_object_key);
      await database.query(
        `INSERT INTO audit_events (organization_id, audit_id, actor_id, event_type, event_data)
         VALUES ($1, $2, $3, 'evidence_package_downloaded', $4)`,
        [request.user.organizationId, request.params.auditId, request.user.sub, JSON.stringify({ evidencePackageId: evidencePackage.rows[0].id })],
      );
      reply.header('Cache-Control', 'private, no-store');
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', `attachment; filename="${safeDownloadFilename(`evidence-package-${evidencePackage.rows[0].id}.zip`)}"`);
      return reply.send(source.Body);
    } catch (error) {
      request.log.error({ packageId: request.params.packageId, error: error.message }, 'Evidence package download failed.');
      return reply.code(404).send({ error: 'Evidence package not found.' });
    }
  });
}