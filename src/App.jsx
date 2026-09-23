import { useEffect, useRef, useState } from 'react';
import { CERTIFICATION_OPTIONS, getLevelConfig } from './data/auditSteps';
import WizardProgress from './components/WizardProgress';
import WizardStep from './components/WizardStep';
import AuditReport from './components/AuditReport';
import ScopingWizard from './components/ScopingWizard';
import ScopeAttestation from './components/ScopeAttestation';
import { EMPTY_SCOPE, migrateScope } from './utils/scopeModel';
import EvidencePack from './components/EvidencePack';
import DocumentLibrary from './components/DocumentLibrary';
import AdminConsole from './components/AdminConsole';
import AuthEntry from './components/AuthEntry';
import { buildCheckpoint, validateCheckpoint } from './utils/auditIO';
import {
  createAudit, deleteDocument, downloadDocument, generateReferencedAnswer, getAudit, getReadiness, getReferencedAnswer,
  clearSession, getWorkspaceAiCapability, listAudits, listDocuments, loadSession, loginWorkspace, registerWorkspace, replaceDocument, retryDocument,
  saveAssessment, saveScope, uploadDocument,
} from './utils/auditApi';
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

function buildScopePayload(scope, { assessorName, organisationName, auditDate, certifications, currentStep, currentScopeSection, view }) {
  return {
    ...scope,
    _dccMetadata: { assessorName, organisationName, auditDate, certifications, currentStep, currentScopeSection, view },
  };
}

function hydrateAssessments(level, savedAssessments) {
  const steps = getLevelConfig(level).steps;
  const nextAssessments = buildInitialAssessments(steps);
  const savedByQuestion = new Map(savedAssessments.map((assessment) => [assessment.question_id, assessment]));
  steps.forEach((step) => {
    step.items.forEach((item) => {
      const saved = savedByQuestion.get(item.id);
      if (!saved) return;
      nextAssessments[step.id][item.id] = {
        ...nextAssessments[step.id][item.id],
        status: saved.status,
        response: saved.response,
        notes: saved.notes,
        evidenceChecklist: saved.evidence_checklist || [],
      };
    });
  });
  return nextAssessments;
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
  const [showEvidence, setShowEvidence] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(0);
  const [scope, setScope] = useState(() => migrateScope(EMPTY_SCOPE));
  const [currentScopeSection, setCurrentScopeSection] = useState(0);
  const [certifications, setCertifications] = useState([]);
  const [importError, setImportError] = useState('');
  const [session, setSession] = useState(loadSession);
  const [auditId, setAuditId] = useState(null);
  const [availableAudits, setAvailableAudits] = useState([]);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [apiError, setApiError] = useState('');
  const [persistenceStatus, setPersistenceStatus] = useState('');
  const [documents, setDocuments] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [loginOrganizations, setLoginOrganizations] = useState([]);
  const [loginOrganizationId, setLoginOrganizationId] = useState('');
  const importInputRef = useRef(null);
  const saveTimersRef = useRef(new Map());

  const levelConfig = getLevelConfig(selectedLevel);
  const activeSteps = levelConfig.steps;

  const totalSteps = activeSteps.length;
  const isLastStep = currentStep === totalSteps - 1;

  useEffect(() => {
    if (!session) return undefined;
    let cancelled = false;
    listAudits(session)
      .then(({ audits }) => { if (!cancelled) setAvailableAudits(audits); })
      .catch((error) => { if (!cancelled) setApiError(error.message); });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getReadiness(),
      session ? getWorkspaceAiCapability(session).catch(() => null) : Promise.resolve(null),
    ])
      .then(([nextReadiness, capability]) => { if (!cancelled) setReadiness({ ...nextReadiness, ...capability }); })
      .catch(() => { if (!cancelled) setReadiness({ openAiConfigured: false }); });
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => () => {
    saveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const scheduleSave = (key, action) => {
    const existingTimer = saveTimersRef.current.get(key);
    if (existingTimer) window.clearTimeout(existingTimer);
    setPersistenceStatus('Saving…');
    saveTimersRef.current.set(key, window.setTimeout(async () => {
      try {
        await action();
        setPersistenceStatus('Saved');
      } catch (error) {
        setPersistenceStatus('Save failed');
        setApiError(error.message);
      } finally {
        saveTimersRef.current.delete(key);
      }
    }, 500));
  };

  const queueScopeSave = (nextScope, nextLevel = selectedLevel, view = 'scope') => {
    if (!session || !auditId) return;
    scheduleSave('scope', () => saveScope(
      session,
      auditId,
      buildScopePayload(nextScope, { assessorName, organisationName, auditDate, certifications, currentStep, currentScopeSection, view }),
      nextLevel,
    ));
  };

  const handleScopeSectionChange = (section) => {
    setCurrentScopeSection(section);
    if (!session || !auditId) return;
    scheduleSave('scope', () => saveScope(
      session,
      auditId,
      buildScopePayload(scope, { assessorName, organisationName, auditDate, certifications, currentStep, currentScopeSection: section, view: 'scope' }),
      selectedLevel,
    ));
  };

  const refreshDocuments = async (targetAuditId = auditId) => {
    if (!session || !targetAuditId) return;
    const response = await listDocuments(session, targetAuditId);
    setDocuments(response.documents);
  };

  const handleItemChange = (stepId, itemId, updates) => {
    const nextAssessment = { ...assessments[stepId][itemId], ...updates };
    setAssessments((prev) => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        [itemId]: { ...prev[stepId][itemId], ...updates },
      },
    }));
    if (session && auditId) {
      scheduleSave(`assessment-${itemId}`, () => saveAssessment(session, auditId, itemId, nextAssessment));
    }
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
      setScope(migrateScope(EMPTY_SCOPE));
      setCurrentScopeSection(0);
      setCertifications([]);
      setAuditId(null);
      setPersistenceStatus('');
      setStarted(false);
    }
  };

  const handleLevelChange = (level) => {
    const nextLevel = getLevelConfig(level);
    setSelectedLevel(level);
    setAssessments(buildInitialAssessments(nextLevel.steps));
    setCurrentStep(0);
    queueScopeSave(scope, level);
  };

  const handleRegisterWorkspace = async () => {
    try {
      setApiError('');
      const nextSession = await registerWorkspace({
        email: accountEmail,
        displayName: assessorName,
        password: accountPassword,
        organizationName: organisationName,
      });
      setSession(nextSession);
      setPersistenceStatus('Workspace connected');
    } catch (error) {
      setApiError(error.message);
    }
  };

  const handleLogin = async () => {
    try {
      setApiError('');
      const result = await loginWorkspace({
        email: accountEmail,
        password: accountPassword,
        ...(loginOrganizationId ? { organizationId: loginOrganizationId } : {}),
      });
      if (result.organizations) {
        setLoginOrganizations(result.organizations);
        setLoginOrganizationId('');
        return;
      }
      setSession(result.session);
      setOrganisationName(result.session.organization.name);
      setAssessorName(result.session.user.displayName);
      setLoginOrganizations([]);
      setPersistenceStatus('Workspace connected');
    } catch (error) {
      setApiError(error.message);
    }
  };

  const handleSignOut = () => {
    clearSession();
    setSession(null);
    setAvailableAudits([]);
    setAuditId(null);
    setStarted(false);
    setShowAdmin(false);
    setApiError('');
    setAccountPassword('');
    setLoginOrganizations([]);
    setLoginOrganizationId('');
  };

  const persistScopeAndStart = async (nextView, nextScope = scope) => {
    if (!session) throw new Error('Create a workspace account before starting a server-backed audit.');
    let nextAuditId = auditId;
    if (!nextAuditId) {
      const created = await createAudit(session, {
        title: `DCC readiness assessment - ${organisationName || session.organization.name} - ${auditDate}`,
        selectedLevel,
        questionCatalogueVersion: 'dcc-applicant-guides-v1.3',
      });
      nextAuditId = created.audit.id;
      setAuditId(nextAuditId);
      setAvailableAudits((current) => [created.audit, ...current]);
    }
    await saveScope(
      session,
      nextAuditId,
      buildScopePayload(nextScope, { assessorName, organisationName, auditDate, certifications, currentStep, currentScopeSection, view: nextView }),
      selectedLevel,
    );
    await refreshDocuments(nextAuditId);
    setPersistenceStatus('Saved');
  };

  const handleScopeContinue = async () => {
    try {
      setPersistenceStatus('Saving…');
      await persistScopeAndStart('attestation');
      setShowScope(false);
      setShowAttestation(true);
    } catch (error) {
      setPersistenceStatus('Save failed');
      setApiError(error.message);
    }
  };

  const handleStartScoping = async () => {
    const nextScope = migrateScope({ ...scope, organisation: { ...scope.organisation, legalName: scope.organisation.legalName || organisationName, assessor: scope.organisation.assessor || assessorName, documentDate: scope.organisation.documentDate || new Date().toISOString().slice(0, 10) } });
    setScope(nextScope);
    setStarted(true);
    setShowScope(true);
    setPersistenceStatus('Saving scope…');
    setApiError('');
    try { await persistScopeAndStart('scope', nextScope); } catch (error) { setPersistenceStatus('Save failed'); setApiError(error.message); }
  };

  const handleStartAudit = async () => {
    try {
      await persistScopeAndStart('audit');
      setShowAttestation(false);
    } catch (error) {
      setPersistenceStatus('Save failed');
      setApiError(error.message);
    }
  };

  const handleResumeAudit = async (nextAuditId) => {
    try {
      setApiError('');
      const { audit, assessments: savedAssessments } = await getAudit(session, nextAuditId);
      const savedScope = audit.scope || {};
      const metadata = savedScope._dccMetadata || {};
      setAuditId(audit.id);
      setSelectedLevel(audit.selected_level);
      setAssessments(hydrateAssessments(audit.selected_level, savedAssessments));
      setScope(migrateScope(Object.fromEntries(Object.entries(savedScope).filter(([key]) => key !== '_dccMetadata'))));
      setCurrentScopeSection(Math.max(0, Math.min(metadata.currentScopeSection || 0, 10)));
      setAssessorName(metadata.assessorName || '');
      setOrganisationName(metadata.organisationName || session.organization.name);
      setAuditDate(metadata.auditDate || new Date().toISOString().slice(0, 10));
      setCertifications(metadata.certifications || []);
      setCurrentStep(Math.min(metadata.currentStep || 0, getLevelConfig(audit.selected_level).steps.length - 1));
      setStarted(true);
      setShowScope(metadata.view === 'scope');
      setShowAttestation(metadata.view === 'attestation');
      setShowReport(metadata.view === 'report');
      await refreshDocuments(audit.id);
      setPersistenceStatus('Saved');
    } catch (error) {
      setApiError(error.message);
    }
  };

  const handleDocumentUpload = async (document) => {
    await uploadDocument(session, auditId, document);
    await refreshDocuments();
  };

  const handleDocumentReplace = async (documentId, document) => {
    await replaceDocument(session, auditId, documentId, document);
    await refreshDocuments();
  };

  const handleDocumentRetry = async (documentId) => {
    await retryDocument(session, auditId, documentId);
    await refreshDocuments();
  };

  const handleDocumentDelete = async (documentId) => {
    await deleteDocument(session, auditId, documentId);
    await refreshDocuments();
  };

  const handleDocumentDownload = (documentId) => downloadDocument(session, auditId, documentId);

  const handleAdminSettingsSaved = () => {
    if (session) getWorkspaceAiCapability(session).then((capability) => setReadiness((current) => ({ ...current, ...capability })));
  };

  const handleWorkspaceUpdated = (workspace) => {
    setSession((current) => ({ ...current, organization: workspace }));
    setOrganisationName(workspace.name);
  };

  const handleWorkspaceDeleted = () => {
    handleSignOut();
    setAuthMode('login');
  };

  const handleGenerateAnswer = (item, refresh) => generateReferencedAnswer(
    session,
    auditId,
    item.id,
    item.label,
    refresh,
  ).then(({ answer }) => answer);

  const handleLoadAnswer = (item) => {
    if (!session || !auditId) return Promise.resolve(null);
    return getReferencedAnswer(session, auditId, item.id).then(({ answer }) => answer);
  };

  const indexedDocumentAvailable = documents.some((document) => (document.ingestion_status || document.status) === 'indexed');
  const answerCapability = !session || !auditId
    ? { enabled: false, message: 'Save this audit before generating referenced policy answers.' }
    : !readiness?.openAiConfigured
      ? { enabled: false, message: 'Referenced answers are unavailable because OpenAI is not configured.' }
      : !indexedDocumentAvailable
        ? { enabled: false, message: 'Upload and index at least one policy document before generating an answer.' }
        : { enabled: true, message: `Uses indexed policy excerpts and ${readiness.answerModel || 'the configured answer model'}; it does not change assessor findings.` };

  const handleScopeChange = (value, group) => {
    const nextScope = group ? { ...scope, [group]: value } : value;
    setScope(nextScope);
    queueScopeSave(nextScope);
  };

  const handleDownloadCheckpoint = () => {
    const checkpoint = buildCheckpoint({
      assessments, assessorName, organisationName, auditDate, scope, certifications, selectedLevel, currentStep, currentScopeSection,
      view: showReport ? 'report' : showAttestation ? 'attestation' : showEvidence ? 'evidence' : showScope ? 'scope' : started ? 'audit' : 'start',
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
      setScope(migrateScope(checkpoint.scope));
      setCurrentScopeSection(Math.max(0, Math.min(checkpoint.currentScopeSection || 0, 10)));
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
      setShowEvidence(checkpoint.view === 'evidence');
      setShowReport(checkpoint.view === 'report');
      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import this checkpoint.');
    }
  };

  if (showAdmin && session?.role === 'org_admin') {
    return (
      <AdminConsole
        session={session}
        onBack={() => setShowAdmin(false)}
        onSettingsSaved={handleAdminSettingsSaved}
        onWorkspaceUpdated={handleWorkspaceUpdated}
        onWorkspaceDeleted={handleWorkspaceDeleted}
        onAccessRevoked={handleSignOut}
      />
    );
  }

  if (!session) {
    return (
      <AuthEntry
        mode={authMode}
        onModeChange={(nextMode) => { setAuthMode(nextMode); setApiError(''); setLoginOrganizations([]); setLoginOrganizationId(''); }}
        email={accountEmail}
        onEmailChange={(value) => { setAccountEmail(value); setLoginOrganizations([]); setLoginOrganizationId(''); }}
        password={accountPassword}
        onPasswordChange={setAccountPassword}
        displayName={assessorName}
        onDisplayNameChange={setAssessorName}
        organizationName={organisationName}
        onOrganizationNameChange={setOrganisationName}
        organizations={loginOrganizations}
        organizationId={loginOrganizationId}
        onOrganizationChange={setLoginOrganizationId}
        onLogin={handleLogin}
        onCreateWorkspace={handleRegisterWorkspace}
        error={apiError}
      />
    );
  }

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
              {session?.role === 'org_admin' && <button className="btn btn-secondary" onClick={() => setShowAdmin(true)}>Admin console</button>}
              <button className="btn btn-primary btn-large" onClick={handleStartScoping}>
                Define Scope
              </button>
              <button className="btn btn-secondary" onClick={handleSignOut}>Sign out</button>
            </div>
            {session && <p className="form-help">Connected as {session.user.display_name || session.user.displayName}.</p>}
            {availableAudits.length > 0 && (
              <section className="saved-audits" aria-labelledby="saved-audits-heading">
                <h3 id="saved-audits-heading">Resume an Audit</h3>
                {availableAudits.map((audit) => <button type="button" className="saved-audit" key={audit.id} onClick={() => handleResumeAudit(audit.id)}>{audit.title}</button>)}
              </section>
            )}
            {(importError || apiError) && <p className="form-error" role="alert">{importError || apiError}</p>}
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
          {persistenceStatus && <span className="persistence-status" role="status">{persistenceStatus}</span>}
          <button className="btn btn-secondary btn-sm reset-btn" onClick={handleDownloadCheckpoint}>Save JSON</button>
          {session?.role === 'org_admin' && <button className="btn btn-secondary btn-sm" onClick={() => setShowAdmin(true)}>Admin</button>}
        </header>
        <ScopingWizard
          scope={scope}
          selectedLevel={selectedLevel}
          onScopeChange={handleScopeChange}
          onLevelChange={handleLevelChange}
          onBack={() => { setShowScope(false); setStarted(false); }}
          onContinue={handleScopeContinue}
          onSkip={() => setShowScope(false)}
          onOpenEvidence={() => { setShowScope(false); setShowEvidence(true); }}
          currentSection={currentScopeSection}
          onSectionChange={handleScopeSectionChange}
          error={apiError}
        />
      </div>
    );
  }

  if (showEvidence) {
    return (
      <div className="app-shell">
        <header className="app-header no-print">
          <span className="app-logo-icon" aria-hidden="true">🛡️</span>
          <div><h1 className="app-title">DCC GDPR Readiness Guide</h1><p className="app-subtitle">Evidence preparation and navigation</p></div>
          <button className="btn btn-secondary btn-sm reset-btn" onClick={handleDownloadCheckpoint}>Save JSON</button>
        </header>
        <EvidencePack levelConfig={levelConfig} onBack={() => { setShowEvidence(false); setShowScope(true); }} />
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
          {session?.role === 'org_admin' && <button className="btn btn-secondary btn-sm" onClick={() => setShowAdmin(true)}>Admin</button>}
        </header>
        <ScopeAttestation
          organisationName={organisationName}
          assessorName={assessorName}
          auditDate={auditDate}
          scope={scope}
          selectedLevel={selectedLevel}
          onBack={() => { setShowAttestation(false); setShowScope(true); }}
          onStartAudit={handleStartAudit}
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
          {session?.role === 'org_admin' && <button className="btn btn-secondary btn-sm" onClick={() => setShowAdmin(true)}>Admin</button>}
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
            session={session}
            auditId={auditId}
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
        {session?.role === 'org_admin' && <button className="btn btn-secondary btn-sm" onClick={() => setShowAdmin(true)}>Admin</button>}
        <button className="btn btn-danger btn-sm reset-btn" onClick={handleReset}>
          New Audit
        </button>
      </header>

      <div className="audit-meta-bar">
        {organisationName && <span><strong>Organisation:</strong> {organisationName}</span>}
        {assessorName && <span><strong>Assessor:</strong> {assessorName}</span>}
        {auditDate && <span><strong>Date:</strong> {formatDate(auditDate)}</span>}
        {persistenceStatus && <span className="persistence-status">{persistenceStatus}</span>}
      </div>

      {auditId && (
        <DocumentLibrary
          documents={documents}
          onUpload={handleDocumentUpload}
          onReplace={handleDocumentReplace}
          onRetry={handleDocumentRetry}
          onDelete={handleDocumentDelete}
          onDownload={handleDocumentDownload}
        />
      )}

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
          answerCapability={answerCapability}
          onGenerateAnswer={handleGenerateAnswer}
          onLoadAnswer={handleLoadAnswer}
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
