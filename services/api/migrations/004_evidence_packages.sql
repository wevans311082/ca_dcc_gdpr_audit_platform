CREATE TYPE evidence_package_status AS ENUM ('queued', 'building', 'ready', 'failed', 'expired');

CREATE TABLE evidence_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status evidence_package_status NOT NULL DEFAULT 'queued',
  report_manifest JSONB NOT NULL,
  source_document_count INTEGER NOT NULL CHECK (source_document_count > 0),
  source_byte_size BIGINT NOT NULL CHECK (source_byte_size >= 0),
  package_byte_size BIGINT CHECK (package_byte_size >= 0),
  package_object_key TEXT UNIQUE,
  queue_job_id TEXT UNIQUE,
  error_message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  expired_at TIMESTAMPTZ
);

CREATE INDEX evidence_packages_audit_idx ON evidence_packages (organization_id, audit_id, requested_at DESC);
CREATE INDEX evidence_packages_expiry_idx ON evidence_packages (status, expires_at);

CREATE TABLE evidence_package_documents (
  evidence_package_id UUID NOT NULL REFERENCES evidence_packages(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256 CHAR(64) NOT NULL,
  source_object_key TEXT NOT NULL,
  PRIMARY KEY (evidence_package_id, document_version_id)
);

CREATE INDEX evidence_package_documents_source_idx ON evidence_package_documents (source_object_key);