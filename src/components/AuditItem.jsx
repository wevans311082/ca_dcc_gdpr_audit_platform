import { STATUS_OPTIONS } from '../data/auditSteps';

export default function AuditItem({ stepId, item, assessment, onChange }) {
  const handleStatusChange = (e) => {
    onChange(stepId, item.id, { status: e.target.value });
  };

  const handleNotesChange = (e) => {
    onChange(stepId, item.id, { notes: e.target.value });
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
