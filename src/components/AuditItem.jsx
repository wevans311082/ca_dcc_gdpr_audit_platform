import { useEffect, useState } from 'react';
import { STATUS_OPTIONS } from '../data/auditSteps';

export default function AuditItem({ stepId, item, assessment, certifications, onChange, answerCapability, onGenerateAnswer, onLoadAnswer }) {
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [referencedAnswer, setReferencedAnswer] = useState(null);
  const [answerError, setAnswerError] = useState('');
  const [answerLoading, setAnswerLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!onLoadAnswer) return undefined;
    onLoadAnswer(item).then((answer) => {
      if (!cancelled) setReferencedAnswer(answer);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [item, onLoadAnswer]);

  const handleStatusChange = (e) => {
    if (e.target.value === 'compliant' && !assessment.response?.trim()) {
      setStatusError('Record an applicant response before marking this question compliant.');
      return;
    }
    setStatusError('');
    onChange(stepId, item.id, { status: e.target.value });
  };

  const handleNotesChange = (e) => {
    onChange(stepId, item.id, { notes: e.target.value });
  };

  const handleResponseChange = (e) => {
    setStatusError('');
    onChange(stepId, item.id, { response: e.target.value });
  };

  const handleChecklistChange = (index) => {
    const evidenceChecklist = [...(assessment.evidenceChecklist || [])];
    evidenceChecklist[index] = !evidenceChecklist[index];
    onChange(stepId, item.id, { evidenceChecklist });
  };

  const currentStatus = STATUS_OPTIONS.find((s) => s.value === assessment.status) || STATUS_OPTIONS[0];

  const handleGenerateAnswer = async (refresh = false) => {
    try {
      setAnswerLoading(true);
      setAnswerError('');
      setReferencedAnswer(await onGenerateAnswer(item, refresh));
    } catch (error) {
      setAnswerError(error.message);
    } finally {
      setAnswerLoading(false);
    }
  };

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
          {statusError && <p className="status-error" role="alert">{statusError}</p>}
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
      {item.documentExamples?.length > 0 && (
        <section className="document-examples" aria-label="Useful document examples">
          <strong>Useful documents to request</strong>
          <ul>{item.documentExamples.map((document) => <li key={document}>{document}</li>)}</ul>
        </section>
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
          <div className="yes-no-response" role="group" aria-label={`Applicant response for ${item.label}`}>
            <button type="button" className={`response-button response-yes ${assessment.response === 'yes' ? 'selected' : ''}`} onClick={() => onChange(stepId, item.id, { response: 'yes' })}>Yes</button>
            <button type="button" className={`response-button response-no ${assessment.response === 'no' ? 'selected' : ''}`} onClick={() => onChange(stepId, item.id, { response: 'no' })}>No</button>
            {assessment.response && <button type="button" className="response-clear" onClick={() => onChange(stepId, item.id, { response: '' })}>Clear</button>}
          </div>
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

      {answerCapability && (
        <section className="referenced-answer" aria-label="Referenced policy answer">
          <div className="referenced-answer-header">
            <div>
              <h3>Referenced Policy Answer</h3>
              <p>{answerCapability.message}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={!answerCapability.enabled || answerLoading}
              title={!answerCapability.enabled ? answerCapability.message : undefined}
              onClick={() => handleGenerateAnswer(Boolean(referencedAnswer))}
            >
              {answerLoading ? 'Generating…' : referencedAnswer ? 'Refresh Answer' : 'Generate Answer'}
            </button>
          </div>
          {referencedAnswer && (
            <div className="referenced-answer-body">
              <div className={`answer-freshness answer-freshness-${referencedAnswer.status || 'current'}`}>
                {referencedAnswer.status === 'stale' ? 'Stale policy answer' : 'Current policy answer'}
              </div>
              {(referencedAnswer.generatedAt || referencedAnswer.created_at || referencedAnswer.model) && (
                <p className="answer-provenance">
                  {referencedAnswer.generatedAt || referencedAnswer.created_at ? `Generated ${new Date(referencedAnswer.generatedAt || referencedAnswer.created_at).toLocaleString('en-GB')}` : 'Generated answer'}
                  {referencedAnswer.model ? ` using ${referencedAnswer.model}` : ''}
                </p>
              )}
              {referencedAnswer.status === 'stale' && <p className="answer-warning">This answer was generated from policy evidence that has since changed or been removed. Refresh it before relying on it for an assessment finding.</p>}
              <p>{referencedAnswer.answer || 'The indexed policy documents do not provide sufficient evidence for this question.'}</p>
              {referencedAnswer.insufficient_evidence && <p className="answer-warning">Insufficient policy evidence was found. Review the document library or request more evidence.</p>}
              {referencedAnswer.limitations && <p className="answer-limitations"><strong>Limitations:</strong> {referencedAnswer.limitations}</p>}
              {referencedAnswer.citations?.length > 0 && (
                <div className="answer-citations">
                  <strong>Policy references</strong>
                  <ul>
                    {referencedAnswer.citations.map((citation, index) => (
                      <li key={`${citation.title}-${citation.page_number || citation.section_heading}-${index}`}>
                        <span>{citation.title} (v{citation.version_number}){citation.page_number ? `, p. ${citation.page_number}` : citation.section_heading ? `, ${citation.section_heading}` : ''}</span>
                        <q>{citation.excerpt}</q>
                        {citation.source_status === 'unavailable' && <small className="citation-unavailable">This cited source is no longer active.</small>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {answerError && <p className="form-error" role="alert">{answerError}</p>}
        </section>
      )}

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
      <div className="audit-item-notes assessor-notes">
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
