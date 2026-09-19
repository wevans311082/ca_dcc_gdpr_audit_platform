export const INGESTION_QUEUE = 'document-ingestion';
export const VECTOR_CLEANUP_QUEUE = 'vector-cleanup';
export const EVIDENCE_PACKAGE_QUEUE = 'evidence-package';
export const QDRANT_DOCUMENT_CHUNK_COLLECTION = 'audit_document_chunks';

export const DOCUMENT_STATUSES = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  INDEXED: 'indexed',
  FAILED: 'failed',
  UNSUPPORTED: 'unsupported',
  DELETED: 'deleted',
});

export function createIngestionJob({ organizationId, auditId, documentId, documentVersionId }) {
  if (![organizationId, auditId, documentId, documentVersionId].every(Boolean)) {
    throw new Error('An ingestion job requires organization, audit, document, and document version IDs.');
  }

  return { organizationId, auditId, documentId, documentVersionId };
}

export function createVectorCleanupJob({ organizationId, auditId, documentId, documentVersionId = null }) {
  if (![organizationId, auditId, documentId].every(Boolean)) {
    throw new Error('A vector cleanup job requires organization, audit, and document IDs.');
  }

  return { organizationId, auditId, documentId, documentVersionId };
}

export async function deleteDocumentVectors(qdrantUrl, cleanup) {
  const must = [
    { key: 'organizationId', match: { value: cleanup.organizationId } },
    { key: 'auditId', match: { value: cleanup.auditId } },
    { key: 'documentId', match: { value: cleanup.documentId } },
  ];
  if (cleanup.documentVersionId) {
    must.push({ key: 'documentVersionId', match: { value: cleanup.documentVersionId } });
  }
  const response = await fetch(`${qdrantUrl.replace(/\/$/, '')}/collections/${QDRANT_DOCUMENT_CHUNK_COLLECTION}/points/delete?wait=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filter: { must } }),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Qdrant vector cleanup returned ${response.status}.`);
}

export function createEvidencePackageJob({ organizationId, auditId, evidencePackageId }) {
  if (![organizationId, auditId, evidencePackageId].every(Boolean)) {
    throw new Error('An evidence package job requires organization, audit, and package IDs.');
  }

  return { organizationId, auditId, evidencePackageId };
}