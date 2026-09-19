# CA DCC GDPR Audit Platform

A wizard-based audit tool to guide assessors through a **DCC Level 0 GDPR audit**.

## Overview

This tool provides a structured, step-by-step wizard that walks an assessor through all the key areas required for a Data Controller Certification (DCC) Level 0 GDPR baseline audit.

### Audit Sections

1. **Applicant Expectations** — GDPR compliance, data subject consent, withdrawal rights, deletion requests, and DPIAs
2. **Policy** — Documentation and policies governing GDPR compliance and risk assessment activities
3. **Implementation Evidence** — DPO details, data processing templates, data mapping, data subject rights, privacy policy
4. **Operational Effectiveness Testing** — Consent walkthroughs, deletion request logs, compliance and DPIA reports
5. **Guiding Questions** — Structured questions to capture applicant explanations and processes
6. **Considerations & Final Assessment** — Data breach review and overall compliance posture

### Key Features

- **Wizard interface** with step-by-step navigation and progress indicator
- **Per-item status** — Compliant / Partially Compliant / Non-Compliant / Not Applicable / Not Assessed
- **Assessor notes** — Free-text notes field per audit item for evidence references and observations
- **Assessment summary** — At-a-glance counts of each compliance status
- **Final report** — A printable/PDF-exportable report covering all sections and findings
- **Session metadata** — Organisation name, assessor name, and audit date captured at the start
- **Reset** — Start a fresh audit at any time

> **Note:** Completing this assessment indicates that the applicant has suitable policies and evidence in place at a baseline level. It does not constitute a legal guarantee of full GDPR compliance.

## Getting Started

### Prerequisites

- Node.js 18 or later

### Install & Run

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

- [React 19](https://react.dev/)
- [Vite 8](https://vitejs.dev/)

## RAG Service Stack

The repository now includes the backend foundation for organization-scoped audit persistence and policy-document RAG:

- PostgreSQL for organizations, users, audits, assessments, document versions, chunks, citations, and audit events
- MinIO for private original document storage
- Redis and BullMQ for document ingestion jobs
- Ollama with `nomic-embed-text` for CPU-only local embeddings
- Qdrant for tenant- and audit-filtered vector retrieval
- OpenAI reserved for the final cited answer-generation step

The API exposes health endpoints at `/api/health` and `/api/ready`, user registration/login, organization-scoped audit persistence, and document upload/list/delete routes. The frontend remains on its existing local workflow while its API integration is built in the next phase.

### Local RAG Development

1. Copy `.env.example` to `.env` and replace placeholder passwords and `JWT_SECRET`.
2. Set `OPENAI_API_KEY` only when the cited-answer endpoint is introduced. It is never exposed to the browser.
3. Start the stack with `docker compose up --build`.
4. The one-shot `migrations` service applies the PostgreSQL schema before the API and worker start. The Ollama initialization service pulls `nomic-embed-text` into a persistent volume.

The initial ingestion worker accepts embedded-text PDF, DOCX, TXT, and Markdown. It marks documents with no extractable text as unsupported; OCR for scanned PDFs and images is intentionally outside this first release.

### Operational Checks

- `GET /api/health` is the API liveness endpoint.
- `GET /api/ready` verifies PostgreSQL, Redis, Qdrant, and Ollama connectivity and returns `503` with per-service states when a required dependency is unavailable.
- Replacing or removing a document creates a durable vector-cleanup record. Qdrant cleanup is asynchronous and retried by the worker; a temporary Redis failure does not roll back the completed document lifecycle change.
- Referenced answers retain their latest result after source changes, but are marked stale until regenerated against the current indexed corpus. Citations identify unavailable sources, and authenticated organization members can download active original documents from the document library.
- ZIP audit exports from a server-backed audit include the latest persisted referenced-answer manifest in `report.json`. Each answer retains its current or stale status, generation metadata, and stored citation excerpts; original policy files are not copied into the ZIP and remain available through the authorized document download action.
- The printable report shows referenced policy answers directly after their related assessment, including stale-evidence and unavailable-source warnings. For a server-backed audit, choose **Prepare Evidence Package** to create a private ZIP containing the immutable report manifest and every active document version captured at request time.
- Evidence packages are available to all authenticated members of the owning organization, have a 500 MB aggregate source-document limit, and expire after seven days. Replaced or deleted source files remain retained only while an unexpired package snapshot requires them; package metadata remains as an expired audit record and can be regenerated.

Run the static checks with:

```bash
npm test
npm run build:services
npm run lint
npm run build
```

On a Docker-enabled host, validate the complete lifecycle by uploading a text policy, waiting for it to reach `indexed`, replacing or deleting it, and confirming that the prior document-version vectors are absent from Qdrant before generating a fresh cited answer.
