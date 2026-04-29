import { AUDIT_STEPS, STATUS_OPTIONS } from '../data/auditSteps';

function StatusBadge({ status }) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  return (
    <span
      className="report-status-badge"
      style={{ backgroundColor: opt.color }}
    >
      {opt.label}
    </span>
  );
}

function computeSummary(assessments) {
  const counts = { compliant: 0, partial: 0, 'non-compliant': 0, 'not-applicable': 0, 'not-assessed': 0 };
  let total = 0;
  AUDIT_STEPS.forEach((step) => {
    step.items.forEach((item) => {
      const a = assessments[step.id]?.[item.id];
      const status = a?.status || 'not-assessed';
      counts[status] = (counts[status] || 0) + 1;
      total++;
    });
  });
  return { counts, total };
}

function overallOutcome(counts) {
  if (counts['non-compliant'] > 0) return { label: 'Non-Compliant', color: '#dc2626' };
  if (counts['not-assessed'] > 0) return { label: 'Incomplete Assessment', color: '#d97706' };
  if (counts['partial'] > 0) return { label: 'Partially Compliant', color: '#d97706' };
  return { label: 'Compliant', color: '#16a34a' };
}

export default function AuditReport({ assessments, assessorName, organisationName, auditDate, onBack }) {
  const { counts, total } = computeSummary(assessments);
  const outcome = overallOutcome(counts);

  const handlePrint = () => window.print();

  return (
    <div className="report-container">
      <header className="report-header">
        <div className="report-logo">
          <span className="shield-icon" aria-hidden="true">🛡️</span>
          <div>
            <h1 className="report-main-title">DCC Level 0 GDPR Audit Report</h1>
            <p className="report-subtitle">Data Controller Certification — GDPR Baseline Assessment</p>
          </div>
        </div>
        <div className="report-meta">
          {organisationName && <p><strong>Organisation:</strong> {organisationName}</p>}
          {assessorName && <p><strong>Assessor:</strong> {assessorName}</p>}
          {auditDate && <p><strong>Audit Date:</strong> {auditDate}</p>}
          <p>
            <strong>Overall Outcome:</strong>{' '}
            <span className="report-status-badge" style={{ backgroundColor: outcome.color }}>
              {outcome.label}
            </span>
          </p>
        </div>
      </header>

      <section className="report-summary-section" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="report-section-title">Assessment Summary</h2>
        <div className="summary-grid">
          <div className="summary-card summary-total">
            <span className="summary-number">{total}</span>
            <span className="summary-label">Total Items</span>
          </div>
          <div className="summary-card summary-compliant">
            <span className="summary-number">{counts.compliant}</span>
            <span className="summary-label">Compliant</span>
          </div>
          <div className="summary-card summary-partial">
            <span className="summary-number">{counts.partial}</span>
            <span className="summary-label">Partially Compliant</span>
          </div>
          <div className="summary-card summary-non-compliant">
            <span className="summary-number">{counts['non-compliant']}</span>
            <span className="summary-label">Non-Compliant</span>
          </div>
          <div className="summary-card summary-na">
            <span className="summary-number">{counts['not-applicable']}</span>
            <span className="summary-label">Not Applicable</span>
          </div>
          <div className="summary-card summary-not-assessed">
            <span className="summary-number">{counts['not-assessed']}</span>
            <span className="summary-label">Not Assessed</span>
          </div>
        </div>
      </section>

      {AUDIT_STEPS.map((step) => (
        <section key={step.id} className="report-step-section" aria-labelledby={`report-step-${step.id}`}>
          <h2 id={`report-step-${step.id}`} className="report-section-title">{step.title}</h2>
          <table className="report-table" aria-label={`${step.title} findings`}>
            <thead>
              <tr>
                <th scope="col" className="col-check">Check</th>
                <th scope="col" className="col-status">Status</th>
                <th scope="col" className="col-notes">Assessor Notes</th>
              </tr>
            </thead>
            <tbody>
              {step.items.map((item) => {
                const a = assessments[step.id]?.[item.id] || { status: 'not-assessed', notes: '' };
                return (
                  <tr key={item.id}>
                    <td className="col-check">{item.label}</td>
                    <td className="col-status">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="col-notes">{a.notes || <em className="no-notes">No notes recorded</em>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="report-footer">
        <p>
          <strong>Disclaimer:</strong> This DCC Level 0 GDPR audit report indicates that the applicant has
          suitable policies and evidence in place at the time of assessment. It does not constitute a legal
          guarantee of full GDPR compliance.
        </p>
        <p>Generated by the CA DCC GDPR Audit Platform · {new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}</p>
      </footer>

      <div className="report-actions no-print">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Audit
        </button>
        <button className="btn btn-primary" onClick={handlePrint}>
          🖨️ Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
