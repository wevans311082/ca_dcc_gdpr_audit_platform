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
