export default function WizardProgress({ steps, currentStep, onStepClick }) {
  if (steps.length > 20) {
    const current = steps[currentStep];
    const progress = ((currentStep + 1) / steps.length) * 100;
    return (
      <nav className="wizard-progress wizard-progress-compact" aria-label="Audit progress">
        <div className="compact-progress-copy">
          <span>Control family {currentStep + 1} of {steps.length}</span>
          <strong>{current.title}</strong>
        </div>
        <div className="compact-progress-track" aria-hidden="true">
          <div className="compact-progress-value" style={{ width: `${progress}%` }} />
        </div>
        <details className="control-index">
          <summary>Control index</summary>
          <ol className="control-index-list">
            {steps.map((step, index) => {
              const isCurrent = index === currentStep;
              const isCompleted = index < currentStep;
              return (
                <li key={step.id} className={isCurrent ? 'current' : ''}>
                  <button
                    type="button"
                    onClick={() => onStepClick(index)}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span aria-hidden="true">{isCompleted ? 'Completed' : index + 1}</span>
                    <span>{step.title}</span>
                    <small>{step.items.length} question{step.items.length === 1 ? '' : 's'}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </details>
      </nav>
    );
  }

  return (
    <nav className="wizard-progress" aria-label="Audit progress">
      <ol className="progress-list">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          return (
            <li
              key={step.id}
              className={`progress-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <button
                className="progress-button"
                onClick={() => onStepClick(index)}
                aria-current={isCurrent ? 'step' : undefined}
                title={step.title}
              >
                <span className="progress-number" aria-hidden="true">
                  {isCompleted ? '✓' : index + 1}
                </span>
                <span className="progress-label">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`progress-connector ${isCompleted ? 'completed' : ''}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
