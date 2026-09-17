import { getLevelConfig, SCOPING_FIELDS } from '../data/auditSteps';

export default function ScopeAttestation({ organisationName, assessorName, auditDate, scope, selectedLevel, onBack, onStartAudit }) {
  const level = getLevelConfig(selectedLevel);

  return (
    <main className="report-main">
      <section className="attestation-document" aria-labelledby="attestation-title">
        <header className="attestation-header">
          <p className="eyebrow">DCC assessment scoping record</p>
          <h1 id="attestation-title">Certificate of Attestation</h1>
          <p>This document records the assessment boundary agreed for assessor handover. It does not record a compliance outcome or award certification.</p>
        </header>

        <dl className="attestation-meta">
          <div><dt>Organisation</dt><dd>{organisationName || 'Not recorded'}</dd></div>
          <div><dt>Assessor</dt><dd>{assessorName || 'Not recorded'}</dd></div>
          <div><dt>Assessment date</dt><dd>{auditDate || 'Not recorded'}</dd></div>
          <div><dt>Assessment level</dt><dd>{level.title} - {level.subtitle}</dd></div>
        </dl>

        <section className="attestation-scope">
          <h2>Agreed scope</h2>
          {SCOPING_FIELDS.map((field) => (
            <div className="attestation-field" key={field.id}>
              <h3>{field.label}</h3>
              <p>{scope[field.id] || 'Not recorded'}</p>
            </div>
          ))}
        </section>

        <section className="attestation-declaration">
          <h2>Declaration</h2>
          <p>
            The organisation and assessor confirm that the scope above accurately describes the intended assessment boundary. Changes to this boundary must be documented and agreed before the assessment is finalised.
          </p>
          <div className="signature-grid">
            <div><span>Applicant representative</span></div>
            <div><span>Assessor</span></div>
          </div>
        </section>

        <div className="report-actions no-print">
          <button className="btn btn-secondary" onClick={onBack}>Back to Scope</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>Print / Save as PDF</button>
          <button className="btn btn-primary" onClick={onStartAudit}>Begin {level.title} Audit</button>
        </div>
      </section>
    </main>
  );
}