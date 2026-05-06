import { STATUS_OPTIONS } from '../data/auditSteps';

// Utility to generate a SHA-256 hash from a File object
async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function AuditItem({ stepId, item, assessment, onChange }) {
  const handleStatusChange = (e) => {
    onChange(stepId, item.id, { status: e.target.value });
  };

  const handleNotesChange = (e) => {
    onChange(stepId, item.id, { notes: e.target.value });
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newEvidence = await Promise.all(
      files.map(async (file) => {
        const hash = await hashFile(file);
        return { file, name: file.name, hash };
      })
    );

    const existingEvidence = assessment.evidenceFiles || [];
    onChange(stepId, item.id, { evidenceFiles: [...existingEvidence, ...newEvidence] });
  };

  const handleRemoveFile = (hashToRemove) => {
    const updatedEvidence = (assessment.evidenceFiles || []).filter(
      (ev) => ev.hash !== hashToRemove
    );
    onChange(stepId, item.id, { evidenceFiles: updatedEvidence });
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
      <div className="audit-item-evidence">
        <label className="evidence-label" htmlFor={`file-${stepId}-${item.id}`}>
          Upload Evidence
        </label>
        <input
          type="file"
          id={`file-${stepId}-${item.id}`}
          multiple
          onChange={handleFileUpload}
          className="evidence-file-input"
        />
        {(assessment.evidenceFiles && assessment.evidenceFiles.length > 0) && (
          <ul className="evidence-file-list">
            {assessment.evidenceFiles.map((ev) => (
              <li key={ev.hash} className="evidence-file-item">
                <div className="evidence-file-info">
                  <span className="evidence-file-name">{ev.name}</span>
                  <span className="evidence-file-hash" title={ev.hash}>
                    SHA-256: {ev.hash.substring(0, 16)}...
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-remove-file"
                  onClick={() => handleRemoveFile(ev.hash)}
                  aria-label={`Remove ${ev.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
