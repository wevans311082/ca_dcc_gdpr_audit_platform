import { AUDIT_STEPS } from '../data/auditSteps';

export default function WizardProgress({ currentStep, onStepClick }) {
  return (
    <nav className="wizard-progress" aria-label="Audit progress">
      <ol className="progress-list">
        {AUDIT_STEPS.map((step, index) => {
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
              {index < AUDIT_STEPS.length - 1 && (
                <div className={`progress-connector ${isCompleted ? 'completed' : ''}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
