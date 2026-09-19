import { STATUS_OPTIONS } from '../data/auditSteps';
import { Fragment, useEffect, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { createEvidencePackage, downloadEvidencePackage, listEvidencePackages, listReferencedAnswers } from '../utils/auditApi';
import { buildReportData } from '../utils/reportExport';

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

function computeSummary(steps, assessments) {
  const counts = { compliant: 0, partial: 0, 'non-compliant': 0, 'not-applicable': 0, 'not-assessed': 0 };
  let total = 0;
  steps.forEach((step) => {
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

function ReportAnswerBlock({ answer }) {
  return (
    <div className="referenced-answer report-referenced-answer">
      <div className={`answer-freshness answer-freshness-${answer.status || 'current'}`}>
        {answer.status === 'stale' ? 'Stale policy answer' : 'Current policy answer'}
      </div>
      {(answer.generatedAt || answer.created_at || answer.model) && (
        <p className="answer-provenance">
          {answer.generatedAt || answer.created_at ? `Generated ${new Date(answer.generatedAt || answer.created_at).toLocaleString('en-GB')}` : 'Generated answer'}
          {answer.model ? ` using ${answer.model}` : ''}
        </p>
      )}
      {answer.status === 'stale' && <p className="answer-warning">This policy answer is historical because its source evidence changed or was removed.</p>}
      <p>{answer.answer || 'The indexed policy documents did not provide sufficient evidence for this question.'}</p>
      {answer.insufficient_evidence && <p className="answer-warning">Insufficient policy evidence was found.</p>}
      {answer.limitations && <p className="answer-limitations"><strong>Limitations:</strong> {answer.limitations}</p>}
      {answer.citations?.length > 0 && (
        <div className="answer-citations">
          <strong>Policy references</strong>
          <ul>{answer.citations.map((citation, index) => (
            <li key={`${citation.title}-${citation.page_number || citation.section_heading}-${index}`}>
              <span>{citation.title} (v{citation.version_number}){citation.page_number ? `, p. ${citation.page_number}` : citation.section_heading ? `, ${citation.section_heading}` : ''}</span>
              <q>{citation.excerpt}</q>
              {citation.source_status === 'unavailable' && <small className="citation-unavailable">This cited source is no longer active.</small>}
            </li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}

export default function AuditReport({ assessments, assessorName, organisationName, auditDate, steps, levelConfig, scope, session, auditId, onBack }) {
  const { counts, total } = computeSummary(steps, assessments);
  const outcome = overallOutcome(counts);
  const [exportState, setExportState] = useState('idle');
  const [exportError, setExportError] = useState('');
  const [referencedAnswers, setReferencedAnswers] = useState([]);
  const [answersState, setAnswersState] = useState(session && auditId ? 'loading' : 'ready');
  const [evidencePackages, setEvidencePackages] = useState([]);
  const [packagesError, setPackagesError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!session || !auditId) return undefined;
    listReferencedAnswers(session, auditId)
      .then(({ answers }) => { if (!cancelled) { setReferencedAnswers(answers); setAnswersState('ready'); } })
      .catch(() => { if (!cancelled) setAnswersState('failed'); });
    return () => { cancelled = true; };
  }, [session, auditId]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    if (!session || !auditId) return undefined;
    const load = async () => {
      try {
        const response = await listEvidencePackages(session, auditId);
        const packages = response.evidencePackages;
        if (!cancelled) setEvidencePackages(packages);
        if (!cancelled && packages.some((evidencePackage) => ['queued', 'building'].includes(evidencePackage.status))) {
          timer = window.setTimeout(load, 5_000);
        }
      } catch (error) {
        if (!cancelled) setPackagesError(error.message);
      }
    };
    load();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [session, auditId]);

  // Extract non-compliant / partially compliant items for gap analysis
  const gapAnalysisItems = [];
  steps.forEach((step) => {
    step.items.forEach((item) => {
      const a = assessments[step.id]?.[item.id];
      if (a && (a.status === 'non-compliant' || a.status === 'partial')) {
        gapAnalysisItems.push({ stepTitle: step.title, itemLabel: item.label, status: a.status, notes: a.notes });
      }
    });
  });

  const handlePrint = () => window.print();

  const handleExportZip = async () => {
    try {
      setExportState('loading');
      setExportError('');
      const zip = new JSZip();
      const evidenceFolder = zip.folder('evidence');
      const reportData = buildReportData({
        assessments, assessorName, organisationName, auditDate, steps, outcome, counts,
        gapAnalysis: gapAnalysisItems, referencedAnswers,
      });

      steps.forEach((step) => {
        step.items.forEach((item) => {
          const assessment = assessments[step.id]?.[item.id] || { evidenceFiles: [] };
          (assessment.evidenceFiles || []).filter((evidence) => evidence.file).forEach((evidence) => {
            evidenceFolder.file(`${evidence.hash.substring(0, 8)}_${evidence.name}`, evidence.file);
          });
        });
      });

      zip.file('report.json', JSON.stringify(reportData, null, 2));
      const content = await zip.generateAsync({ type: 'blob' });
      const dateStr = auditDate ? auditDate.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const safeOrgName = organisationName ? organisationName.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'org';
      saveAs(content, `GDPR_Audit_${safeOrgName}_${dateStr}.zip`);
    } catch (error) {
      setExportError(error.message || 'The audit data could not be exported.');
    } finally {
      setExportState('idle');
    }
  };

  const handlePreparePackage = async () => {
    try {
      setExportState('loading');
      setExportError('');
      await createEvidencePackage(session, auditId);
      const response = await listEvidencePackages(session, auditId);
      setEvidencePackages(response.evidencePackages);
    } catch (error) {
      setExportError(error.message || 'The evidence package could not be prepared.');
    } finally {
      setExportState('idle');
    }
  };

  const handleDownloadPackage = async (packageId) => {
    try {
      setExportError('');
      await downloadEvidencePackage(session, auditId, packageId);
    } catch (error) {
      setExportError(error.message || 'The evidence package could not be downloaded.');
    }
  };

  const answersByQuestionId = new Map(referencedAnswers.map((answer) => [answer.question_id, answer]));

  return (
    <div className="report-container">
      <header className="report-header">
        <div className="report-logo">
          <span className="shield-icon" aria-hidden="true">🛡️</span>
          <div>
            <h1 className="report-main-title">DCC GDPR Readiness Findings Report</h1>
            <p className="report-subtitle">{levelConfig.title} — {levelConfig.subtitle}</p>
          </div>
        </div>
        <div className="report-meta">
          {organisationName && <p><strong>Organisation:</strong> {organisationName}</p>}
          {assessorName && <p><strong>Assessor:</strong> {assessorName}</p>}
          {auditDate && <p><strong>Audit Date:</strong> {auditDate}</p>}
          {scope?.inScopeDescription && <p><strong>Scope:</strong> {scope.inScopeDescription}</p>}
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

      {steps.map((step) => (
        <section key={step.id} className="report-step-section" aria-labelledby={`report-step-${step.id}`}>
          <h2 id={`report-step-${step.id}`} className="report-section-title">{step.title}</h2>
          <table className="report-table" aria-label={`${step.title} findings`}>
            <thead>
              <tr>
                <th scope="col" className="col-check">Check</th>
                <th scope="col" className="col-response">Applicant Response</th>
                <th scope="col" className="col-status">Status</th>
                <th scope="col" className="col-notes">Assessor Notes</th>
              </tr>
            </thead>
            <tbody>
              {step.items.map((item) => {
                const a = assessments[step.id]?.[item.id] || { status: 'not-assessed', notes: '', evidenceChecklist: [] };
                const completedChecks = (a.evidenceChecklist || []).filter(Boolean).length;
                const referencedAnswer = answersByQuestionId.get(item.id);
                return (
                  <Fragment key={item.id}>
                    <tr key={item.id}>
                      <td className="col-check">{item.label}</td>
                      <td className="col-response">{a.response || <em className="no-notes">No response recorded</em>}</td>
                      <td className="col-status"><StatusBadge status={a.status} /></td>
                      <td className="col-notes">
                        {a.notes || <em className="no-notes">No notes recorded</em>}
                        {item.keyChecks?.length > 0 && <p className="evidence-check-summary">Evidence checks: {completedChecks} of {item.keyChecks.length}</p>}
                      </td>
                    </tr>
                    {referencedAnswer && <tr className="report-answer-row" key={`${item.id}-policy-answer`}><td colSpan="4"><ReportAnswerBlock answer={referencedAnswer} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <footer className="report-footer">
        <p>
          <strong>Disclaimer:</strong> This DCC GDPR readiness findings report indicates that the applicant has
          suitable policies and evidence in place at the time of assessment. It does not constitute a legal
          guarantee of full GDPR compliance.
        </p>
        <p>Generated by the CA DCC GDPR Audit Platform · {new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}</p>
      </footer>

      <div className="report-actions no-print">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Audit
        </button>
        <button className="btn btn-primary" onClick={session && auditId ? handlePreparePackage : handleExportZip} disabled={exportState === 'loading'}>
          {exportState === 'loading' ? 'Preparing Export…' : session && auditId ? 'Prepare Evidence Package' : '📦 Export Audit Data (ZIP)'}
        </button>
        <button className="btn btn-primary" onClick={handlePrint}>
          🖨️ Print / Save as PDF
        </button>
      </div>
      {session && auditId && answersState === 'loading' && <p className="report-evidence-state">Loading referenced policy evidence for this report.</p>}
      {session && auditId && answersState === 'failed' && <p className="form-error" role="alert">Referenced policy evidence could not be loaded, so it is not shown in this report.</p>}
      {session && auditId && evidencePackages.length > 0 && (
        <section className="evidence-package-history no-print" aria-label="Evidence package history">
          <h2>Evidence Packages</h2>
          {evidencePackages.map((evidencePackage) => (
            <div className="evidence-package-row" key={evidencePackage.id}>
              <span><strong>{evidencePackage.status}</strong> · {evidencePackage.sourceDocumentCount} documents · {(evidencePackage.sourceByteSize / 1_048_576).toFixed(1)} MB · expires {new Date(evidencePackage.expiresAt).toLocaleDateString('en-GB')}</span>
              {evidencePackage.status === 'ready' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDownloadPackage(evidencePackage.id)}>Download</button>}
              {evidencePackage.errorMessage && <small className="form-error">{evidencePackage.errorMessage}</small>}
            </div>
          ))}
        </section>
      )}
      {(exportError || packagesError) && <p className="form-error no-print" role="alert">{exportError || packagesError}</p>}
    </div>
  );
}
