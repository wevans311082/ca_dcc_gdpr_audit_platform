CREATE TABLE vector_cleanup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE,
  operation TEXT NOT NULL CHECK (operation IN ('replace', 'delete', 'retry')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  queue_job_id TEXT UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  error_message TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX vector_cleanup_jobs_pending_idx ON vector_cleanup_jobs (status, created_at)
  WHERE status IN ('queued', 'failed');

CREATE UNIQUE INDEX vector_cleanup_jobs_active_scope_idx
  ON vector_cleanup_jobs (organization_id, audit_id, document_id, COALESCE(document_version_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('queued', 'processing');