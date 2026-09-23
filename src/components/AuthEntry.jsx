import { useState } from 'react';

export default function AuthEntry({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  displayName,
  onDisplayNameChange,
  organizationName,
  onOrganizationNameChange,
  organizations,
  organizationId,
  onOrganizationChange,
  onLogin,
  onCreateWorkspace,
  error,
}) {
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') await onLogin();
      else await onCreateWorkspace();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <header className="auth-masthead">
        <span className="auth-crest" aria-hidden="true">D</span>
        <div>
          <p className="auth-kicker">Cyber Ask · Assessment workspace</p>
          <h1>DCC Readiness</h1>
        </div>
      </header>
      <main className="auth-main">
        <section className="auth-panel" aria-labelledby="auth-heading">
          <div className="auth-panel-heading">
            <p className="auth-kicker">Defence Cyber Certification</p>
            <h2 id="auth-heading">{mode === 'login' ? 'Sign in to your workspace' : 'Establish a workspace'}</h2>
            <p>{mode === 'login' ? 'Continue to your organisation’s assessment records.' : 'Create an organisation workspace and become its first administrator.'}</p>
          </div>
          <div className="auth-mode-switch" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => onModeChange('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'is-active' : ''} onClick={() => onModeChange('create')}>Create workspace</button>
          </div>
          <form className="auth-form" onSubmit={submit}>
            {mode === 'create' && (
              <>
                <label className="auth-field" htmlFor="auth-organization">
                  <span>Organisation name</span>
                  <input id="auth-organization" autoComplete="organization" required value={organizationName} onChange={(event) => onOrganizationNameChange(event.target.value)} placeholder="e.g. Acme Defence Ltd" />
                </label>
                <label className="auth-field" htmlFor="auth-display-name">
                  <span>Your name</span>
                  <input id="auth-display-name" autoComplete="name" required value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} placeholder="Name of workspace administrator" />
                </label>
              </>
            )}
            <label className="auth-field" htmlFor="auth-email">
              <span>Work email</span>
              <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@organisation.example" />
            </label>
            <label className="auth-field" htmlFor="auth-password">
              <span>Password</span>
              <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'create' ? 12 : undefined} required value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={mode === 'create' ? 'At least 12 characters' : 'Your workspace password'} />
            </label>
            {mode === 'login' && organizations.length > 0 && (
              <label className="auth-field" htmlFor="auth-workspace">
                <span>Choose workspace</span>
                <select id="auth-workspace" value={organizationId} onChange={(event) => onOrganizationChange(event.target.value)} required>
                  <option value="">Select an organisation</option>
                  {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
              </label>
            )}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : mode === 'login' ? organizations.length && !organizationId ? 'Find my workspaces' : 'Sign in' : 'Create workspace'}
            </button>
          </form>
          <p className="auth-footnote">Workspace administrators manage team access. Assessment records are available only to authenticated workspace members.</p>
        </section>
        <aside className="auth-side-note">
          <span className="auth-rule" />
          <p className="auth-side-title">Assessment preparation, in good order.</p>
          <p>Organise scope, evidence, and control findings within a secure workspace for your team.</p>
          <div className="auth-side-stamp">DCC<br />0–2</div>
        </aside>
      </main>
      <footer className="auth-footer">DCC readiness support · This tool does not award certification or constitute legal advice.</footer>
    </div>
  );
}