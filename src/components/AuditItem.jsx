import { useState } from 'react';
import { STATUS_OPTIONS } from '../data/auditSteps';

export default function AuditItem({ stepId, item, assessment, certifications, onChange }) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);

  const handleStatusChange = (e) => {
    onChange(stepId, item.id, { status: e.target.value });
  };

  const handleNotesChange = (e) => {
    onChange(stepId, item.id, { notes: e.target.value });
  };

  const handleResponseChange = (e) => {
    onChange(stepId, item.id, { response: e.target.value });
  };

  const handleChecklistChange = (index) => {
    const evidenceChecklist = [...(assessment.evidenceChecklist || [])];
    evidenceChecklist[index] = !evidenceChecklist[index];
    onChange(stepId, item.id, { evidenceChecklist });
  };

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === assessment.status) || STATUS_OPTIONS[0];

  return (
    <div className={`audit-item status-${assessment.status}`}>
      <div className="audit-item-header">
        <p className="audit-item-label">{item.label}</p>
        <div className="status-selector">
          <label htmlFor={`status-${stepId}-${item.id}`} className="visually-hidden">
            Status for: {item.label}
          </label>
          <select
            id={`status-${stepId}-${item.id}`}
            value={assessment.status}
            onChange={handleStatusChange}
            className="status-select"
            style={{ borderColor: currentStatus.color }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {item.hint && (
        <p className="audit-item-hint">
          <span className="hint-icon" aria-hidden="true">💡</span> {item.hint}
        </p>
      )}
      {item.exampleEvidence && (
        <p className="audit-item-example">
          <span className="example-icon" aria-hidden="true">📂</span> <strong>Example Evidence:</strong> {item.exampleEvidence}
        </p>
      )}
      {item.frameworkHints?.length > 0 && certifications?.some((certification) => certification === 'iso27001' || certification === 'cyberEssentials' || certification === 'cyberEssentialsPlus') && (
        <div className="framework-hints" aria-label="Potential existing evidence coverage">
          {item.frameworkHints.map((hint) => {
            const isIsoHint = hint.startsWith('ISO');
            const supported = isIsoHint ? certifications.includes('iso27001') : certifications.includes('cyberEssentials') || certifications.includes('cyberEssentialsPlus');
            return supported && <span key={hint} className="framework-pill">Potential coverage: {hint}</span>;
          })}
        </div>
      )}
      <div className="audit-item-response">
        <label htmlFor={`response-${stepId}-${item.id}`} className="notes-label">Applicant Response</label>
        {item.responseType === 'yes-no' ? (
          <select
            id={`response-${stepId}-${item.id}`}
            value={assessment.response || ''}
            onChange={handleResponseChange}
            className="form-input response-select"
          >
            <option value="">Select response</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        ) : (
          <>
            <textarea
              id={`response-${stepId}-${item.id}`}
              value={assessment.response || ''}
              onChange={handleResponseChange}
              placeholder="Record the applicant's response in their own words."
              rows={4}
              className="notes-textarea"
            />
            <p className="model-answer"><strong>Model response:</strong> {item.modelAnswer}</p>
          </>
        )}
      </div>

      {(item.whatGoodLooksLike || (item.keyChecks && item.keyChecks.length > 0)) && (
        <div className="guidance-container">
          <button
            type="button"
            className="guidance-toggle"
            onClick={() => setGuidanceOpen((o) => !o)}
            aria-expanded={guidanceOpen}
          >
            <span className="guidance-toggle-icon" aria-hidden="true">{guidanceOpen ? '▲' : '▼'}</span>
            {guidanceOpen ? 'Hide Assessor Guidance' : 'Show Assessor Guidance'}
          </button>
          {guidanceOpen && (
            <div className="guidance-panel">
              {item.whatGoodLooksLike && (
                <div className="guidance-section">
                  <h4 className="guidance-section-title">
                    <span aria-hidden="true">✅</span> What good looks like
                  </h4>
                  <p className="guidance-section-body">{item.whatGoodLooksLike}</p>
                </div>
              )}
              {item.keyChecks && item.keyChecks.length > 0 && (
                <div className="guidance-section">
                  <h4 className="guidance-section-title">
                    <span aria-hidden="true">🔍</span> Key checks for the assessor
                  </h4>
                  <ul className="guidance-checklist" aria-label="Evidence checks">
                    {item.keyChecks.map((check, i) => (
                      <li key={check} className="guidance-checklist-item">
                        <label className="evidence-check-label">
                          <input
                            type="checkbox"
                            checked={Boolean(assessment.evidenceChecklist?.[i])}
                            onChange={() => handleChecklistChange(i)}
                          />
                          <span>{check}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="audit-item-notes">
        <label htmlFor={`notes-${stepId}-${item.id}`} className="notes-label">
          Assessor Notes
        </label>
        <textarea
          id={`notes-${stepId}-${item.id}`}
          value={assessment.notes}
          onChange={handleNotesChange}
          placeholder="Record your findings, evidence references, or observations here…"
          rows={3}
          className="notes-textarea"
        />
      </div>
    </div>
  );
}
