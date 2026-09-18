import { LEVEL_CONFIGS, SCOPING_FIELDS } from '../data/auditSteps';
import EvidencePack from './EvidencePack';

export default function ScopingWizard({ scope, selectedLevel, onScopeChange, onLevelChange, onBack, onContinue, onSkip }) {
  const selectedConfig = LEVEL_CONFIGS[selectedLevel];
  const isComplete = SCOPING_FIELDS.every((field) => scope[field.id]?.trim());

  return (
    <main className="wizard-main scope-main">
      <section className="wizard-step" aria-labelledby="scope-title">
        <header className="step-header">
          <p className="eyebrow">Assessment scoping</p>
          <h2 id="scope-title" className="step-title">Define the assessment boundary</h2>
          <p className="step-description">
            Record the agreed scope before beginning the audit. These details form the Certificate of Attestation for the assessor.
          </p>
        </header>

        <div className="scope-form">
          <div className="form-group">
            <label className="form-label" htmlFor="scope-level">Assessment level</label>
            <select id="scope-level" className="form-input" value={selectedLevel} onChange={(event) => onLevelChange(Number(event.target.value))}>
              {Object.values(LEVEL_CONFIGS).map((level) => (
                <option key={level.id} value={level.id} disabled={!level.available}>
                  {level.title} - {level.subtitle}{!level.available ? ' (source transcription pending)' : ''}
                </option>
              ))}
            </select>
            <p className="form-help">Source: {selectedConfig.source}</p>
          </div>

          {SCOPING_FIELDS.map((field) => (
            <div className="form-group" key={field.id}>
              <label className="form-label" htmlFor={`scope-${field.id}`}>{field.label}</label>
              <textarea
                id={`scope-${field.id}`}
                className="notes-textarea"
                rows={3}
                value={scope[field.id] || ''}
                onChange={(event) => onScopeChange(field.id, event.target.value)}
                aria-describedby={`scope-help-${field.id}`}
              />
              <p id={`scope-help-${field.id}`} className="form-help">{field.help}</p>
            </div>
          ))}

          <EvidencePack levelConfig={selectedConfig} />
        </div>

        <div className="wizard-nav">
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <button className="btn btn-secondary" onClick={onSkip}>Skip Scoping</button>
          <button className="btn btn-primary" onClick={onContinue} disabled={!isComplete}>
            Review Certificate of Attestation
          </button>
        </div>
      </section>
    </main>
  );
}