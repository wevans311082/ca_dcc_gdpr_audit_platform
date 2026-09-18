import { useRef, useState } from 'react';
import { CERTIFICATION_OPTIONS, getLevelConfig } from './data/auditSteps';
import WizardProgress from './components/WizardProgress';
import WizardStep from './components/WizardStep';
import AuditReport from './components/AuditReport';
import ScopingWizard from './components/ScopingWizard';
import ScopeAttestation from './components/ScopeAttestation';
import { buildCheckpoint, validateCheckpoint } from './utils/auditIO';
import './App.css';

function buildInitialAssessments(steps = getLevelConfig(0).steps) {
  const initial = {};
  steps.forEach((step) => {
    initial[step.id] = {};
    step.items.forEach((item) => {
      initial[step.id][item.id] = {
        status: 'not-assessed', response: '', evidenceFiles: [], evidenceChecklist: [], notes: '',
      };
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
  const [showScope, setShowScope] = useState(false);
  const [showAttestation, setShowAttestation] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [scope, setScope] = useState({});
  const [certifications, setCertifications] = useState([]);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef(null);

  const levelConfig = getLevelConfig(selectedLevel);
  const activeSteps = levelConfig.steps;

  const totalSteps = activeSteps.length;
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
      setShowScope(false);
      setShowAttestation(false);
      setSelectedLevel(0);
      setScope({});
      setCertifications([]);
      setStarted(false);
    }
  };

  const handleLevelChange = (level) => {
    const nextLevel = getLevelConfig(level);
    setSelectedLevel(level);
    setAssessments(buildInitialAssessments(nextLevel.steps));
    setCurrentStep(0);
  };

  const handleDownloadCheckpoint = () => {
    const checkpoint = buildCheckpoint({
      assessments, assessorName, organisationName, auditDate, scope, certifications, selectedLevel, currentStep,
      view: showReport ? 'report' : showAttestation ? 'attestation' : showScope ? 'scope' : started ? 'audit' : 'start',
    });
    const blob = new Blob([JSON.stringify(checkpoint, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const safeName = organisationName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'assessment';
    link.href = URL.createObjectURL(blob);
    link.download = `dcc_gdpr_${safeName}_checkpoint.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleImportCheckpoint = async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    try {
      const checkpoint = validateCheckpoint(JSON.parse(await file.text()));
      setAssessorName(checkpoint.metadata.assessorName || '');
      setOrganisationName(checkpoint.metadata.organisationName || '');
      setAuditDate(checkpoint.metadata.auditDate || new Date().toISOString().slice(0, 10));
      setCertifications(checkpoint.metadata.certifications || []);
      setScope(checkpoint.scope);
      setSelectedLevel(checkpoint.selectedLevel);
      setAssessments(Object.fromEntries(
        Object.entries(checkpoint.assessments).map(([stepId, items]) => [
          stepId,
          Object.fromEntries(Object.entries(items).map(([itemId, assessment]) => [
            itemId,
            {
              ...assessment,
              evidenceFiles: (assessment.evidenceReferences || []).map((reference) => ({
                ...reference,
                unavailable: true,
              })),
            },
          ])),
        ])
      ));
      setCurrentStep(Math.min(checkpoint.currentStep || 0, getLevelConfig(checkpoint.selectedLevel).steps.length - 1));
      setStarted(checkpoint.view !== 'start');
      setShowScope(checkpoint.view === 'scope');
      setShowAttestation(checkpoint.view === 'attestation');
      setShowReport(checkpoint.view === 'report');
      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import this checkpoint.');
    }
  };

  if (!started) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <span className="app-logo-icon" aria-hidden="true">🛡️</span>
          <div>
            <h1 className="app-title">DCC Readiness Guide</h1>
            <p className="app-subtitle">Defence Cyber Certification — Levels 0 to 2 Assessment Preparation</p>
          </div>
        </header>
        <main className="start-screen">
          <div className="start-card">
            <h2 className="start-heading">Welcome to DCC Assessment Preparation</h2>
            <p className="start-intro">
              This tool supports DCC Levels 0, 1, and 2. Each level shows its official control total and the individual source questions used to assess those controls.
            </p>
            <ul className="start-list">
              {[0, 1, 2, 3].map((level) => (
                <li key={level}>
                  <span aria-hidden="true">✅</span> {getLevelConfig(level).title}: {getLevelConfig(level).controlCount} official controls; {getLevelConfig(level).available ? `${getLevelConfig(level).steps.flatMap((step) => step.items).length} source questions` : 'question bank pending'}
                </li>
              ))}
            </ul>
            <p className="start-note">
              <strong>Note:</strong> This is readiness tooling based on the supplied DCC Applicant Guides.
              It supports preparation and evidence gathering; it does not award DCC certification or
              constitute legal advice.
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
              <fieldset className="certification-fieldset">
                <legend className="form-label">Existing company certifications</legend>
                <p className="form-help">Select current certifications. Relevant controls will show a potential-coverage indicator for the assessor.</p>
                <div className="certification-options">
                  {CERTIFICATION_OPTIONS.map((option) => (
                    <label key={option.id} className="certification-option">
                      <input
                        type="checkbox"
                        checked={certifications.includes(option.id)}
                        onChange={(event) => setCertifications((current) => event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id))}
                      />
                      <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="start-actions">
              <button className="btn btn-secondary" onClick={() => importInputRef.current?.click()}>Import JSON</button>
              <button className="btn btn-primary btn-large" onClick={() => { setStarted(true); setShowScope(true); }}>
                Define Scope
              </button>
            </div>
            {importError && <p className="form-error" role="alert">{importError}</p>}
            <input ref={importInputRef} type="file" accept="application/json" className="visually-hidden" onChange={handleImportCheckpoint} />
          </div>
        </main>
      </div>
    );
  }

  if (showScope) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <span className="app-logo-icon" aria-hidden="true">🛡️</span>
          <div><h1 className="app-title">DCC GDPR Readiness Guide</h1><p className="app-subtitle">Scope agreement and assessment preparation</p></div>
          <button className="btn btn-secondary btn-sm reset-btn" onClick={handleDownloadCheckpoint}>Save JSON</button>
        </header>
        <ScopingWizard
          scope={scope}
          selectedLevel={selectedLevel}
          onScopeChange={(field, value) => setScope((previous) => ({ ...previous, [field]: value }))}
          onLevelChange={handleLevelChange}
          onBack={() => { setShowScope(false); setStarted(false); }}
          onContinue={() => { setShowScope(false); setShowAttestation(true); }}
          onSkip={() => setShowScope(false)}
        />
      </div>
    );
  }

  if (showAttestation) {
    return (
      <div className="app-shell">
        <header className="app-header no-print">
          <span className="app-logo-icon" aria-hidden="true">🛡️</span>
          <div><h1 className="app-title">DCC GDPR Readiness Guide</h1><p className="app-subtitle">Scope agreement and assessment preparation</p></div>
          <button className="btn btn-secondary btn-sm reset-btn" onClick={handleDownloadCheckpoint}>Save JSON</button>
        </header>
        <ScopeAttestation
          organisationName={organisationName}
          assessorName={assessorName}
          auditDate={auditDate}
          scope={scope}
          selectedLevel={selectedLevel}
          onBack={() => { setShowAttestation(false); setShowScope(true); }}
          onStartAudit={() => setShowAttestation(false)}
        />
      </div>
    );
  }

  if (showReport) {
    return (
      <div className="app-shell">
        <header className="app-header no-print">
          <span className="app-logo-icon" aria-hidden="true">🛡️</span>
          <div>
            <h1 className="app-title">DCC GDPR Readiness Findings</h1>
            <p className="app-subtitle">{levelConfig.title} — {levelConfig.subtitle}</p>
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
            steps={activeSteps}
            levelConfig={levelConfig}
            scope={scope}
            onBack={() => {
              setShowReport(false);
              setCurrentStep(totalSteps - 1);
            }}
          />
        </main>
      </div>
    );
  }

  const step = activeSteps[currentStep];

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-logo-icon" aria-hidden="true">🛡️</span>
        <div>
          <h1 className="app-title">DCC GDPR Readiness Guide</h1>
          <p className="app-subtitle">{levelConfig.title} — {levelConfig.subtitle}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleDownloadCheckpoint}>Save JSON</button>
        <button className="btn btn-danger btn-sm reset-btn" onClick={handleReset}>
          New Audit
        </button>
      </header>

      <div className="audit-meta-bar">
        {organisationName && <span><strong>Organisation:</strong> {organisationName}</span>}
        {assessorName && <span><strong>Assessor:</strong> {assessorName}</span>}
        {auditDate && <span><strong>Date:</strong> {formatDate(auditDate)}</span>}
      </div>

      <WizardProgress
        steps={activeSteps}
        currentStep={currentStep}
        onStepClick={handleStepClick}
      />

      <main className="wizard-main">
        <WizardStep
          step={step}
          stepAssessments={assessments[step.id]}
          certifications={certifications}
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
