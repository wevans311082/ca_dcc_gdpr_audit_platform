import { AUDIT_STEPS, STATUS_OPTIONS } from '../data/auditSteps';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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
  if (counts['non-compliant'] > 0) return { label: 'Non-Compliant', color: '#dc2626', recommendation: 'Immediate action required to address non-compliant areas before submitting for DCC certification.' };
  if (counts['not-assessed'] > 0) return { label: 'Incomplete Assessment', color: '#d97706', recommendation: 'Complete the assessment to generate a final outcome.' };
  if (counts['partial'] > 0) return { label: 'Partially Compliant', color: '#d97706', recommendation: 'Address partially compliant areas to ensure a strong posture before submitting for DCC certification.' };
  return { label: 'Compliant', color: '#16a34a', recommendation: 'The applicant appears to have suitable baseline policies and evidence in place. Good to proceed with DCC certification submission.' };
}

export default function AuditReport({ assessments, assessorName, organisationName, auditDate, onBack }) {
  const { counts, total } = computeSummary(assessments);
  const outcome = overallOutcome(counts);

  // Extract non-compliant / partially compliant items for gap analysis
  const gapAnalysisItems = [];
  AUDIT_STEPS.forEach((step) => {
    step.items.forEach((item) => {
      const a = assessments[step.id]?.[item.id];
      if (a && (a.status === 'non-compliant' || a.status === 'partial')) {
        gapAnalysisItems.push({ stepTitle: step.title, itemLabel: item.label, status: a.status, notes: a.notes });
      }
    });
  });

  const handlePrint = () => window.print();

  const handleExportZip = async () => {
    const zip = new JSZip();
    const evidenceFolder = zip.folder("evidence");

    const reportData = {
      meta: {
        organisationName,
        assessorName,
        auditDate,
        outcome: outcome.label,
        counts,
      },
      gapAnalysis: gapAnalysisItems,
      details: {},
    };

    AUDIT_STEPS.forEach((step) => {
      reportData.details[step.id] = { title: step.title, items: {} };
      step.items.forEach((item) => {
        const a = assessments[step.id]?.[item.id] || { status: 'not-assessed', notes: '', evidenceFiles: [] };

        const evidenceSummary = (a.evidenceFiles || []).map(ev => ({
          name: ev.name,
          hash: ev.hash
        }));

        reportData.details[step.id].items[item.id] = {
          label: item.label,
          status: a.status,
          notes: a.notes,
          evidence: evidenceSummary
        };

        (a.evidenceFiles || []).forEach(ev => {
          // Store the file in the zip under the evidence folder
          // Using hash to prevent naming collisions
          const fileName = `${ev.hash.substring(0, 8)}_${ev.name}`;
          evidenceFolder.file(fileName, ev.file);
        });
      });
    });

    zip.file("report.json", JSON.stringify(reportData, null, 2));

    const content = await zip.generateAsync({ type: "blob" });
    const dateStr = auditDate ? auditDate.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeOrgName = organisationName ? organisationName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'org';
    saveAs(content, `GDPR_Audit_${safeOrgName}_${dateStr}.zip`);
  };

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
        <div className="outcome-recommendation" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderLeft: `4px solid ${outcome.color}`, borderRadius: '4px' }}>
          <p style={{ margin: 0 }}><strong>Recommendation:</strong> {outcome.recommendation}</p>
        </div>
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

      {gapAnalysisItems.length > 0 && (
        <section className="report-summary-section" aria-labelledby="gap-analysis-heading">
          <h2 id="gap-analysis-heading" className="report-section-title">Gap Analysis</h2>
          <p style={{ marginBottom: '1rem', color: '#64748b' }}>The following areas require attention (Non-Compliant or Partially Compliant):</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem' }}>
            {gapAnalysisItems.map((gap, index) => (
              <li key={index} style={{ marginBottom: '0.75rem' }}>
                <strong>{gap.stepTitle}:</strong> {gap.itemLabel}
                <br />
                <span className="report-status-badge" style={{ backgroundColor: STATUS_OPTIONS.find(s => s.value === gap.status)?.color, marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                  {STATUS_OPTIONS.find(s => s.value === gap.status)?.label}
                </span>
                {gap.notes && <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid #cbd5e1' }}>{gap.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <button className="btn btn-primary" onClick={handleExportZip}>
          📦 Export Audit Data (ZIP)
        </button>
        <button className="btn btn-primary" onClick={handlePrint}>
          🖨️ Print / Save as PDF
        </button>
      </div>
    </div>
  );
}
