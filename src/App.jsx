import { useState } from 'react';
import { AUDIT_STEPS } from './data/auditSteps';
import WizardProgress from './components/WizardProgress';
import WizardStep from './components/WizardStep';
import AuditReport from './components/AuditReport';
import './App.css';

function buildInitialAssessments() {
  const initial = {};
  AUDIT_STEPS.forEach((step) => {
    initial[step.id] = {};
    step.items.forEach((item) => {
      initial[step.id][item.id] = { status: 'not-assessed', notes: '', evidenceFiles: [] };
    });
  });
  return initial;
}

/** Format a YYYY-MM-DD date string without timezone shifting. */
function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB');
}

export default function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [assessments, setAssessments] = useState(buildInitialAssessments);
  const [showReport, setShowReport] = useState(false);
  const [assessorName, setAssessorName] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().slice(0, 10));
  const [started, setStarted] = useState(false);

  const totalSteps = AUDIT_STEPS.length;
  const isLastStep = currentStep === totalSteps - 1;

  const handleItemChange = (stepId, itemId, updates) => {
    setAssessments((prev) => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        [itemId]: { ...prev[stepId][itemId], ...updates },
      },
    }));
  };

  const handleNext = () => {
    if (isLastStep) {
      setShowReport(true);
    } else {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepClick = (index) => {
    setCurrentStep(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset the audit? All responses will be lost.')) {
      setAssessments(buildInitialAssessments());
      setCurrentStep(0);
      setShowReport(false);
      setStarted(false);
    }
  };

  if (!started) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <span className="app-logo-icon" aria-hidden="true">🛡️</span>
          <div>
            <h1 className="app-title">DCC Level 0 GDPR Audit Platform</h1>
            <p className="app-subtitle">Defence Cyber Certification — Baseline GDPR Assessment Tool</p>
          </div>
        </header>
        <main className="start-screen">
          <div className="start-card">
            <h2 className="start-heading">Welcome to the GDPR Audit Wizard</h2>
            <p className="start-intro">
              This tool guides assessors through a structured DCC Level 0 GDPR audit covering:
            </p>
            <ul className="start-list">
              {AUDIT_STEPS.map((step) => (
                <li key={step.id}>
                  <span aria-hidden="true">✅</span> {step.title}
                </li>
              ))}
            </ul>
            <p className="start-note">
              <strong>Note:</strong> Completing this assessment indicates that the applicant has
              suitable policies and evidence at a baseline level. It does not constitute a legal
              guarantee of full GDPR compliance.
            </p>

            <div className="start-form">
              <div className="form-group">
                <label htmlFor="org-name" className="form-label">Organisation Name</label>
                <input
                  id="org-name"
                  type="text"
                  className="form-input"
                  value={organisationName}
                  onChange={(e) => setOrganisationName(e.target.value)}
                  placeholder="e.g. Acme Corp Ltd"
                />
              </div>
              <div className="form-group">
                <label htmlFor="assessor-name" className="form-label">Assessor Name</label>
                <input
                  id="assessor-name"
                  type="text"
                  className="form-input"
                  value={assessorName}
                  onChange={(e) => setAssessorName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                />
              </div>
              <div className="form-group">
                <label htmlFor="audit-date" className="form-label">Audit Date</label>
                <input
                  id="audit-date"
                  type="date"
                  className="form-input"
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                />
              </div>
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={() => setStarted(true)}
            >
              Begin Audit →
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (showReport) {
    return (
      <div className="app-shell">
        <header className="app-header no-print">
          <span className="app-logo-icon" aria-hidden="true">🛡️</span>
          <div>
            <h1 className="app-title">DCC Level 0 GDPR Audit Platform</h1>
            <p className="app-subtitle">Defence Cyber Certification — Baseline GDPR Assessment Tool</p>
          </div>
          <button className="btn btn-danger btn-sm reset-btn" onClick={handleReset}>
            New Audit
          </button>
        </header>
        <main className="report-main">
          <AuditReport
            assessments={assessments}
            assessorName={assessorName}
            organisationName={organisationName}
            auditDate={auditDate}
            onBack={() => {
              setShowReport(false);
              setCurrentStep(totalSteps - 1);
            }}
          />
        </main>
      </div>
    );
  }

  const step = AUDIT_STEPS[currentStep];

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-logo-icon" aria-hidden="true">🛡️</span>
        <div>
          <h1 className="app-title">DCC Level 0 GDPR Audit Platform</h1>
          <p className="app-subtitle">Defence Cyber Certification — Baseline GDPR Assessment Tool</p>
        </div>
        <button className="btn btn-danger btn-sm reset-btn" onClick={handleReset}>
          New Audit
        </button>
      </header>

      <div className="audit-meta-bar">
        {organisationName && <span><strong>Organisation:</strong> {organisationName}</span>}
        {assessorName && <span><strong>Assessor:</strong> {assessorName}</span>}
        {auditDate && <span><strong>Date:</strong> {formatDate(auditDate)}</span>}
      </div>

      <WizardProgress currentStep={currentStep} onStepClick={handleStepClick} />

      <main className="wizard-main">
        <WizardStep
          step={step}
          stepAssessments={assessments[step.id]}
          onItemChange={handleItemChange}
        />

        <div className="wizard-nav">
          <button
            className="btn btn-secondary"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            ← Previous
          </button>

          <span className="step-counter">
            Step {currentStep + 1} of {totalSteps}
          </span>

          <button className="btn btn-primary" onClick={handleNext}>
            {isLastStep ? 'Generate Report →' : 'Next →'}
          </button>
        </div>
      </main>
    </div>
  );
}
