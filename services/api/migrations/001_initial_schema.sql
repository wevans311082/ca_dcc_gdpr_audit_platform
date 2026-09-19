CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE organization_role AS ENUM ('org_admin', 'assessor', 'viewer');
CREATE TYPE audit_status AS ENUM ('draft', 'in_progress', 'completed', 'archived');
CREATE TYPE document_status AS ENUM ('queued', 'processing', 'indexed', 'failed', 'unsupported', 'deleted');
CREATE TYPE answer_status AS ENUM ('current', 'stale', 'failed');

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role organization_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  selected_level SMALLINT NOT NULL CHECK (selected_level BETWEEN 0 AND 3),
  question_catalogue_version TEXT NOT NULL,
  status audit_status NOT NULL DEFAULT 'draft',
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  attested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audits_organization_id_idx ON audits (organization_id, updated_at DESC);

CREATE TABLE audit_question_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  question JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_id, question_id)
);

CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not-assessed',
  response TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  evidence_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audit_id, question_id)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'queued',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documents_audit_id_idx ON documents (organization_id, audit_id, status);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  sha256 CHAR(64) NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  parser_version TEXT,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number),
  UNIQUE (document_id, sha256)
);

CREATE TABLE ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  status document_status NOT NULL DEFAULT 'queued',
  queue_job_id TEXT UNIQUE,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ingestion_jobs_document_id_idx ON ingestion_jobs (document_id, created_at DESC);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  content_hash CHAR(64) NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  section_heading TEXT,
  source_start INTEGER,
  source_end INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, chunk_index)
);

CREATE TABLE answer_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  corpus_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  model TEXT NOT NULL,
  status answer_status NOT NULL DEFAULT 'current',
  answer TEXT NOT NULL,
  policy_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations TEXT,
  insufficient_evidence BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invalidated_at TIMESTAMPTZ
);

CREATE INDEX answer_generations_current_idx ON answer_generations (organization_id, audit_id, question_id, status, created_at DESC);

CREATE TABLE answer_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_generation_id UUID NOT NULL REFERENCES answer_generations(id) ON DELETE CASCADE,
  document_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE RESTRICT,
  relevance_score DOUBLE PRECISION NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
  excerpt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (answer_generation_id, document_chunk_id)
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_audit_id_idx ON audit_events (organization_id, audit_id, created_at DESC);