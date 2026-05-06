import { useState } from 'react';
import { STATUS_OPTIONS } from '../data/auditSteps';

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES_PER_ITEM = 10;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'text/plain', 'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

// Utility to generate a SHA-256 hash from a File object
async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function AuditItem({ stepId, item, assessment, onChange }) {
  const [uploadError, setUploadError] = useState(null);

  const handleStatusChange = (e) => {
    onChange(stepId, item.id, { status: e.target.value });
  };

  const handleNotesChange = (e) => {
    onChange(stepId, item.id, { notes: e.target.value });
  };

  const handleFileUpload = async (e) => {
    setUploadError(null);
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const existingEvidence = assessment.evidenceFiles || [];
    const slotsAvailable = MAX_FILES_PER_ITEM - existingEvidence.length;

    if (slotsAvailable <= 0) {
      setUploadError(`Maximum of ${MAX_FILES_PER_ITEM} files per item has been reached.`);
      e.target.value = '';
      return;
    }

    const rejected = [];
    const accepted = files.slice(0, slotsAvailable).filter((file) => {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        rejected.push(`"${file.name}" — unsupported file type.`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push(`"${file.name}" — exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
        return false;
      }
      return true;
    });

    if (files.length > slotsAvailable) {
      rejected.push(`Only ${slotsAvailable} more file(s) allowed; extras were skipped.`);
    }

    if (rejected.length > 0) {
      setUploadError(rejected.join(' '));
    }

    if (accepted.length === 0) {
      e.target.value = '';
      return;
    }

    const newEvidence = await Promise.all(
      accepted.map(async (file) => {
        const hash = await hashFile(file);
        return { file, name: file.name, hash };
      })
    );

    // Deduplicate by hash
    const existingHashes = new Set(existingEvidence.map((ev) => ev.hash));
    const deduplicated = newEvidence.filter((ev) => {
      if (existingHashes.has(ev.hash)) {
        setUploadError((prev) => (prev ? prev + ` "${ev.name}" is a duplicate and was skipped.` : `"${ev.name}" is a duplicate and was skipped.`));
        return false;
      }
      return true;
    });

    onChange(stepId, item.id, { evidenceFiles: [...existingEvidence, ...deduplicated] });
    e.target.value = '';
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
          <span className="evidence-hint"> (PDF, Word, Excel, images — max {MAX_FILE_SIZE_MB} MB each, up to {MAX_FILES_PER_ITEM} files)</span>
        </label>
        <input
          type="file"
          id={`file-${stepId}-${item.id}`}
          multiple
          onChange={handleFileUpload}
          className="evidence-file-input"
          aria-describedby={uploadError ? `upload-error-${stepId}-${item.id}` : undefined}
        />
        {uploadError && (
          <p
            id={`upload-error-${stepId}-${item.id}`}
            className="upload-error"
            role="alert"
            style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.4rem' }}
          >
            ⚠ {uploadError}
          </p>
        )}
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
