import { useEffect, useState } from 'react';
import {
  createAdminMember, deleteAdminWorkspace, downloadDocument, getAdminAiSettings, getAdminWorkspace,
  listAdminDocuments, listAdminMembers, removeAdminMember, renameAdminWorkspace, saveAdminAiSettings,
  getAdminServices, testAdminAiSettings, testAdminOllama, updateAdminMemberRole,
} from '../utils/auditApi';

const tabs = [
  { id: 'settings', label: 'AI settings' },
  { id: 'services', label: 'Services' },
  { id: 'uploads', label: 'Uploaded files' },
  { id: 'members', label: 'Members & workspace' },
  { id: 'api', label: 'API reference' },
];

function formatSize(size) {
  if (size === null || size === undefined) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function StatusLabel({ status }) {
  const normalizedStatus = String(status || 'unknown').toLowerCase().replaceAll(' ', '-');
  return <span className={`admin-status admin-status-${normalizedStatus}`}>{status || 'unknown'}</span>;
}

export default function AdminConsole({ session, onBack, onSettingsSaved, onWorkspaceUpdated, onWorkspaceDeleted, onAccessRevoked }) {
  const [activeTab, setActiveTab] = useState('settings');
  const [settings, setSettings] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [answerModel, setAnswerModel] = useState('');
  const [models, setModels] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [ollamaTest, setOllamaTest] = useState(null);
  const [services, setServices] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [workspaceName, setWorkspaceName] = useState(session.organization?.name || '');
  const [memberForm, setMemberForm] = useState({ email: '', displayName: '', password: '', role: 'assessor' });
  const [confirmWorkspaceName, setConfirmWorkspaceName] = useState('');
  const [openApi, setOpenApi] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refreshSettings = async () => {
    const next = await getAdminAiSettings(session);
    setSettings(next);
    setAnswerModel(next.answerModel);
  };

  const refreshDocuments = async () => {
    const result = await listAdminDocuments(session);
    setDocuments(result.documents);
  };

  const refreshMembers = async () => {
    const result = await listAdminMembers(session);
    setMembers(result.members);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAdminAiSettings(session).catch((settingsError) => ({ settingsError })),
      listAdminDocuments(session),
      getAdminWorkspace(session),
      listAdminMembers(session),
      fetch('/api/openapi.json').then((response) => {
        if (!response.ok) throw new Error('The OpenAPI document could not be loaded.');
        return response.json();
      }),
    ]).then(([nextSettings, inventory, currentWorkspace, workspaceMembers, spec]) => {
      if (cancelled) return;
      if (nextSettings.settingsError) {
        setError(`OpenAI settings could not be loaded: ${nextSettings.settingsError.message}`);
      } else {
        setSettings(nextSettings);
        setAnswerModel(nextSettings.answerModel);
      }
      setDocuments(inventory.documents);
      setWorkspaceName(currentWorkspace.workspace.name);
      setMembers(workspaceMembers.members);
      setOpenApi(spec);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message);
    });
    return () => { cancelled = true; };
  }, [session]);

  const runAction = async (action, successMessage) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await action();
      setMessage(successMessage);
      return result ?? true;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    const result = await runAction(
      () => testAdminAiSettings(session, { apiKey, answerModel }),
      'API key accepted. Available answer models loaded.',
    );
    if (result) {
      const answerModels = result.models.filter((model) => (
        /^(gpt-|chatgpt-|o1(?:-|$)|o3(?:-|$)|o4(?:-|$))/i.test(model)
        && !/(audio|realtime|transcribe|tts|embedding|whisper|moderation)/i.test(model)
      ));
      setModels(answerModels);
      setTestResult(result);
      setMessage(result.modelAvailable === false
        ? 'API key works, but the selected model is not listed for this key. Choose an available model before saving.'
        : `API key works. ${answerModels.length} answer models are available.`);
    }
  };

  const handleOllamaTest = async () => {
    const result = await runAction(
      () => testAdminOllama(session),
      'Ollama embedding test succeeded.',
    );
    if (result) setOllamaTest(result);
    else setOllamaTest({ connected: false, error: error || 'Ollama embedding test failed.' });
  };

  const refreshServices = async () => {
    const result = await getAdminServices(session);
    setServices(result);
    return result;
  };

  const handleSave = async () => {
    const result = await runAction(
      () => saveAdminAiSettings(session, { apiKey, answerModel }),
      'AI settings saved for this workspace.',
    );
    if (result) {
      setApiKey('');
      await refreshSettings();
      onSettingsSaved?.();
    }
  };

  const handleClearKey = async () => {
    const result = await runAction(
      () => saveAdminAiSettings(session, { answerModel, clearApiKey: true }),
      'Workspace API key removed.',
    );
    if (result) {
      await refreshSettings();
      onSettingsSaved?.();
    }
  };

  const handleSaveWorkspace = async (event) => {
    event.preventDefault();
    const result = await runAction(() => renameAdminWorkspace(session, workspaceName), 'Workspace name updated.');
    if (result) onWorkspaceUpdated?.(result.workspace);
  };

  const handleCreateMember = async (event) => {
    event.preventDefault();
    const result = await runAction(() => createAdminMember(session, memberForm), 'Workspace member added.');
    if (result) {
      setMemberForm({ email: '', displayName: '', password: '', role: 'assessor' });
      await refreshMembers();
    }
  };

  const handleMemberRoleChange = async (userId, role) => {
    const result = await runAction(() => updateAdminMemberRole(session, userId, role), 'Member role updated.');
    if (result && userId === session.user.id && role !== 'org_admin') {
      onAccessRevoked?.();
      return;
    }
    await refreshMembers();
  };

  const handleRemoveMember = async (member) => {
    if (!window.confirm(`Remove ${member.email} from this workspace? Their account and access to other workspaces will remain.`)) return;
    const result = await runAction(() => removeAdminMember(session, member.id), 'Member removed from this workspace.');
    if (result && member.id === session.user.id) {
      onAccessRevoked?.();
      return;
    }
    await refreshMembers();
  };

  const handleDeleteWorkspace = async (event) => {
    event.preventDefault();
    const result = await runAction(
      () => deleteAdminWorkspace(session, confirmWorkspaceName),
      'Workspace and its audit data deleted.',
    );
    if (result) onWorkspaceDeleted?.();
  };

  const activeDocuments = documents.filter((document) => !document.deleted_at);
  const indexedDocuments = activeDocuments.filter((document) => (document.ingestion_status || document.status) === 'indexed');
  const failedDocuments = activeDocuments.filter((document) => ['failed', 'unsupported'].includes(document.ingestion_status || document.status));
  const totalBytes = activeDocuments.reduce((total, document) => total + (document.byte_size || 0), 0);

  return (
    <div className="admin-shell">
      <header className="app-header admin-header">
        <span className="admin-mark" aria-hidden="true">A</span>
        <div className="admin-heading">
          <h1 className="app-title">Workspace administration</h1>
          <p className="app-subtitle">{session.organization?.name || 'Organization'} · {session.user?.email}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>Back to audit</button>
      </header>

      <main className="admin-main">
        <nav className="admin-tabs" aria-label="Administration sections" role="tablist">
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`admin-tab${activeTab === tab.id ? ' is-active' : ''}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {error && <p className="admin-alert is-error" role="alert">{error}</p>}
        {message && <p className="admin-alert is-success" role="status">{message}</p>}

        {activeTab === 'settings' && (
          <section className="admin-section" aria-labelledby="ai-settings-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">Provider connection</p>
                <h2 id="ai-settings-title">OpenAI settings</h2>
              </div>
              <StatusLabel status={settings?.configured ? 'configured' : 'not configured'} />
            </div>
            <p className="admin-copy">The API key is encrypted before it is stored. Existing keys are never returned to the browser.</p>
            {settings?.keyError && <p className="admin-alert is-error" role="alert">{settings.keyError}</p>}
            <div className="admin-form-grid">
              <label className="admin-field admin-field-wide" htmlFor="admin-api-key">
                <span>API key</span>
                <input
                  id="admin-api-key"
                  className="form-input"
                  type="password"
                  autoComplete="new-password"
                  value={apiKey}
                  onChange={(event) => { setApiKey(event.target.value); setTestResult(null); }}
                  placeholder={settings?.maskedApiKey || 'Paste a provider API key'}
                />
                <small>{settings?.configuredByOrganization ? 'A workspace key is saved. Leave blank to keep it.' : 'A server-level key may be active as a fallback.'}</small>
              </label>
              <label className="admin-field" htmlFor="admin-answer-model">
                <span>Answer model</span>
                <select id="admin-answer-model" className="form-input" value={answerModel} onChange={(event) => { setAnswerModel(event.target.value); setTestResult(null); }}>
                  {[...new Set([answerModel, ...models].filter(Boolean))].map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
                <small>Model used for cited policy answers.</small>
              </label>
            </div>
            <div className="admin-actions">
              <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={busy}>
                {busy ? 'Checking…' : 'Test key and load models'}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={busy || !answerModel}>
                Save settings
              </button>
              {settings?.configuredByOrganization && (
                <button type="button" className="admin-text-button" onClick={handleClearKey} disabled={busy}>Remove saved key</button>
              )}
            </div>
            {models.length > 0 && <p className="admin-copy">{models.length} model IDs returned by the provider. A model may be listed but unavailable to your account.</p>}
            <div className="admin-subsection-heading">
              <div><h3>Local embedding service</h3><p className="admin-copy">Document embeddings use Ollama locally with the configured embedding model. This does not require an OpenAI key.</p></div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleOllamaTest} disabled={busy}>{busy ? 'Testing…' : 'Test Ollama embedding'}</button>
            </div>
            {ollamaTest && <p className={`admin-alert ${ollamaTest.connected ? 'is-success' : 'is-error'}`} role="status">
              {ollamaTest.connected ? `Ollama is connected. ${ollamaTest.model} returned a ${ollamaTest.dimensions}-dimension embedding.` : `Ollama test failed: ${ollamaTest.error}`}
            </p>}
          </section>
        )}

        {activeTab === 'services' && (
          <section className="admin-section" aria-labelledby="services-title">
            <div className="admin-section-heading">
              <div><p className="admin-eyebrow">Infrastructure diagnostics</p><h2 id="services-title">Databases, workers &amp; services</h2></div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => runAction(refreshServices, 'Service status refreshed.')} disabled={busy}>Refresh status</button>
            </div>
            {!services && <p className="admin-copy">Load service status to check database, storage, embedding, and queue connections.</p>}
            {services && <>
              <p className="admin-copy">Last checked {formatDate(services.checkedAt)}. Queue availability shows Redis queue access and job counts; it does not prove a worker process is actively running.</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Service</th><th>Status</th><th>Details</th></tr></thead>
                  <tbody>{services.services.map((service) => <tr key={service.name}>
                    <td><strong>{service.name}</strong></td>
                    <td><StatusLabel status={service.status} /></td>
                    <td>{service.detail}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>}
          </section>
        )}

        {activeTab === 'uploads' && (
          <section className="admin-section" aria-labelledby="upload-register-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">Evidence inventory</p>
                <h2 id="upload-register-title">Uploaded files</h2>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => runAction(refreshDocuments, 'Upload inventory refreshed.')} disabled={busy}>Refresh</button>
            </div>
            <div className="admin-metrics" aria-label="Upload summary">
              <div><span>Active files</span><strong>{activeDocuments.length}</strong></div>
              <div><span>Indexed</span><strong>{indexedDocuments.length}</strong></div>
              <div><span>Needs attention</span><strong>{failedDocuments.length}</strong></div>
              <div><span>Active storage</span><strong>{formatSize(totalBytes)}</strong></div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>File</th><th>Audit</th><th>Ingestion</th><th>Size</th><th>Uploaded by</th><th>Uploaded</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={`${document.id}-${document.version_id || 'none'}`} className={document.deleted_at ? 'is-deleted' : ''}>
                      <td>
                        <strong>{document.title}</strong>
                        <small>{document.original_filename || 'No file version'}{document.version_number ? ` · v${document.version_number}` : ''}</small>
                        {document.error_message && <small className="admin-error-detail">{document.error_message}</small>}
                      </td>
                      <td>{document.audit_title}</td>
                      <td><StatusLabel status={document.deleted_at ? 'deleted' : document.ingestion_status || document.status} /></td>
                      <td>{formatSize(document.byte_size)}</td>
                      <td>{document.uploaded_by}</td>
                      <td>{formatDate(document.version_created_at || document.created_at)}</td>
                      <td>{!document.deleted_at && document.version_id && <button className="admin-icon-button" type="button" title="Download file" aria-label={`Download ${document.original_filename}`} onClick={() => runAction(() => downloadDocument(session, document.audit_id, document.id), 'Download started.')}>↓</button>}</td>
                    </tr>
                  ))}
                  {documents.length === 0 && <tr><td colSpan="7" className="admin-empty">No uploaded files in this workspace.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'members' && (
          <section className="admin-section admin-members-section" aria-labelledby="members-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">Access and ownership</p>
                <h2 id="members-title">Members &amp; workspace</h2>
              </div>
            </div>
            <form className="workspace-name-form" onSubmit={handleSaveWorkspace}>
              <label className="admin-field" htmlFor="workspace-display-name">
                <span>Workspace name</span>
                <input id="workspace-display-name" className="form-input" required minLength="2" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
              </label>
              <button type="submit" className="btn btn-primary" disabled={busy || workspaceName.trim().length < 2}>Save name</button>
            </form>

            <div className="admin-subsection-heading">
              <div><h3>Workspace members</h3><p className="admin-copy">New users receive the password you set here. Existing accounts keep their current password.</p></div>
            </div>
            <form className="member-create-form" onSubmit={handleCreateMember}>
              <label className="admin-field" htmlFor="member-email"><span>Email</span><input id="member-email" className="form-input" type="email" required value={memberForm.email} onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))} /></label>
              <label className="admin-field" htmlFor="member-name"><span>Display name</span><input id="member-name" className="form-input" value={memberForm.displayName} onChange={(event) => setMemberForm((current) => ({ ...current, displayName: event.target.value }))} placeholder="Required for a new account" /></label>
              <label className="admin-field" htmlFor="member-password"><span>Initial password</span><input id="member-password" className="form-input" type="password" minLength="12" autoComplete="new-password" value={memberForm.password} onChange={(event) => setMemberForm((current) => ({ ...current, password: event.target.value }))} placeholder="12+ characters; new accounts only" /></label>
              <label className="admin-field" htmlFor="member-role"><span>Role</span><select id="member-role" className="form-input" value={memberForm.role} onChange={(event) => setMemberForm((current) => ({ ...current, role: event.target.value }))}><option value="assessor">Assessor</option><option value="viewer">Viewer</option><option value="org_admin">Administrator</option></select></label>
              <button type="submit" className="btn btn-primary member-create-submit" disabled={busy}>Add member</button>
            </form>

            <div className="admin-table-wrap">
              <table className="admin-table member-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Member since</th><th aria-label="Actions" /></tr></thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td><strong>{member.display_name}</strong>{member.id === session.user.id && <small>You</small>}</td>
                      <td>{member.email}</td>
                      <td><select className="member-role-select" aria-label={`Role for ${member.email}`} value={member.role} onChange={(event) => handleMemberRoleChange(member.id, event.target.value)} disabled={busy}><option value="org_admin">Administrator</option><option value="assessor">Assessor</option><option value="viewer">Viewer</option></select></td>
                      <td>{formatDate(member.joined_at)}</td>
                      <td><button className="admin-text-button" type="button" disabled={busy} onClick={() => handleRemoveMember(member)}>Remove</button></td>
                    </tr>
                  ))}
                  {members.length === 0 && <tr><td colSpan="5" className="admin-empty">No members found.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="workspace-delete-section">
              <p className="admin-eyebrow">Irreversible action</p>
              <h3>Delete this workspace</h3>
              <p className="admin-copy">This permanently removes all audits, assessment responses, uploaded files, evidence packages, and workspace access. User accounts remain if they belong to other workspaces.</p>
              <form className="workspace-delete-form" onSubmit={handleDeleteWorkspace}>
                <label className="admin-field" htmlFor="confirm-workspace-delete"><span>Type <strong>{workspaceName}</strong> to confirm</span><input id="confirm-workspace-delete" className="form-input" autoComplete="off" value={confirmWorkspaceName} onChange={(event) => setConfirmWorkspaceName(event.target.value)} /></label>
                <button type="submit" className="btn btn-danger" disabled={busy || confirmWorkspaceName !== workspaceName}>Delete workspace</button>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'api' && (
          <section className="admin-section" aria-labelledby="api-reference-title">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">Integration</p>
                <h2 id="api-reference-title">API reference</h2>
              </div>
              <a className="btn btn-secondary btn-sm" href="/api/openapi.json" target="_blank" rel="noreferrer">Open OpenAPI JSON</a>
            </div>
            <p className="admin-copy">OpenAPI 3.1 specification for workspace and administration endpoints. Authenticated operations accept the session JWT as a bearer token.</p>
            {!openApi && <p className="admin-copy">Loading API operations…</p>}
            {openApi && <div className="admin-operations">
              {Object.entries(openApi.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => (
                <div className="admin-operation" key={`${method}-${path}`}>
                  <span className={`admin-method admin-method-${method}`}>{method.toUpperCase()}</span>
                  <code>{path}</code>
                  <span>{operation.summary}</span>
                </div>
              )))}
            </div>}
          </section>
        )}
      </main>
    </div>
  );
}
