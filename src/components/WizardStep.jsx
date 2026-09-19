import AuditItem from './AuditItem';

export default function WizardStep({ step, stepAssessments, certifications, onItemChange, answerCapability, onGenerateAnswer, onLoadAnswer }) {
  return (
    <section className="wizard-step" aria-labelledby={`step-title-${step.id}`}>
      <header className="step-header">
        <h2 id={`step-title-${step.id}`} className="step-title">
          {step.title}
        </h2>
        <p className="step-description">{step.description}</p>
      </header>

      <div className="audit-items-list">
        {step.items.map((item) => (
          <AuditItem
            key={item.id}
            stepId={step.id}
            item={item}
            assessment={stepAssessments?.[item.id] || { status: 'not-assessed', notes: '', evidenceFiles: [], evidenceChecklist: [] }}
            certifications={certifications}
            onChange={onItemChange}
            answerCapability={answerCapability}
            onGenerateAnswer={onGenerateAnswer}
            onLoadAnswer={onLoadAnswer}
          />
        ))}
      </div>
    </section>
  );
}
