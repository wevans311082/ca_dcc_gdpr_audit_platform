import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvidencePackageJob, deleteDocumentVectors } from './index.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('deleteDocumentVectors', () => {
  it('deletes only the requested organization, audit, document, and version vectors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock;

    await deleteDocumentVectors('http://qdrant:6333/', {
      organizationId: 'organization-1', auditId: 'audit-1', documentId: 'document-1', documentVersionId: 'version-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://qdrant:6333/collections/audit_document_chunks/points/delete?wait=true',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      filter: {
        must: [
          { key: 'organizationId', match: { value: 'organization-1' } },
          { key: 'auditId', match: { value: 'audit-1' } },
          { key: 'documentId', match: { value: 'document-1' } },
          { key: 'documentVersionId', match: { value: 'version-1' } },
        ],
      },
    });
  });

  it('deletes all document versions only when no version is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock;

    await deleteDocumentVectors('http://qdrant:6333', {
      organizationId: 'organization-1', auditId: 'audit-1', documentId: 'document-1',
    });

    const { filter } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(filter.must).toHaveLength(3);
    expect(filter.must.map((clause) => clause.key)).not.toContain('documentVersionId');
  });

  it('treats a missing collection as an already-clean scope', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(deleteDocumentVectors('http://qdrant:6333', {
      organizationId: 'organization-1', auditId: 'audit-1', documentId: 'document-1',
    })).resolves.toBeUndefined();
  });
});

describe('createEvidencePackageJob', () => {
  it('requires and preserves the package snapshot scope', () => {
    expect(createEvidencePackageJob({
      organizationId: 'organization-1', auditId: 'audit-1', evidencePackageId: 'package-1',
    })).toEqual({ organizationId: 'organization-1', auditId: 'audit-1', evidencePackageId: 'package-1' });
    expect(() => createEvidencePackageJob({ organizationId: 'organization-1', auditId: 'audit-1' }))
      .toThrow('An evidence package job requires organization, audit, and package IDs.');
  });
});