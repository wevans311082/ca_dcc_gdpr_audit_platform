const sessionKey = 'dcc-audit-session';

function request(path, { token, body, method = 'GET' } = {}) {
  return fetch(`/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (response) => {
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The audit service could not complete this request.');
    return data;
  });
}

export function loadSession() {
  try {
    return JSON.parse(window.localStorage.getItem(sessionKey)) || null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(sessionKey);
}

export async function registerWorkspace(account) {
  const response = await request('/auth/register', { method: 'POST', body: account });
  const session = {
    token: response.token,
    user: response.user,
    organization: response.organization,
    role: response.role,
  };
  saveSession(session);
  return session;
}

export function listAudits(session) {
  return request('/audits', { token: session.token });
}

export function getAudit(session, auditId) {
  return request(`/audits/${auditId}`, { token: session.token });
}

export function createAudit(session, audit) {
  return request('/audits', { token: session.token, method: 'POST', body: audit });
}

export function saveScope(session, auditId, scope, selectedLevel) {
  return request(`/audits/${auditId}/scope`, {
    token: session.token,
    method: 'PUT',
    body: { scope, selectedLevel },
  });
}

export function saveAssessment(session, auditId, questionId, assessment) {
  return request(`/audits/${auditId}/assessments/${encodeURIComponent(questionId)}`, {
    token: session.token,
    method: 'PUT',
    body: {
      status: assessment.status,
      response: assessment.response,
      notes: assessment.notes,
      evidenceChecklist: assessment.evidenceChecklist,
    },
  });
}

export function listDocuments(session, auditId) {
  return request(`/audits/${auditId}/documents`, { token: session.token });
}

export async function uploadDocument(session, auditId, { file, title }) {
  const body = new FormData();
  body.append('file', file);
  if (title) body.append('title', title);
  const response = await fetch(`/api/audits/${auditId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The document could not be uploaded.');
  return data;
}

export function deleteDocument(session, auditId, documentId) {
  return request(`/audits/${auditId}/documents/${documentId}`, { token: session.token, method: 'DELETE' });
}

export async function replaceDocument(session, auditId, documentId, { file, title }) {
  const body = new FormData();
  body.append('file', file);
  if (title) body.append('title', title);
  const response = await fetch(`/api/audits/${auditId}/documents/${documentId}/replace`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The document could not be replaced.');
  return data;
}

export function retryDocument(session, auditId, documentId) {
  return request(`/audits/${auditId}/documents/${documentId}/retry`, { token: session.token, method: 'POST' });
}

export function getReadiness() {
  return request('/ready');
}

export function getReferencedAnswer(session, auditId, questionId) {
  return request(`/audits/${auditId}/questions/${encodeURIComponent(questionId)}/answer`, { token: session.token });
}

export function listReferencedAnswers(session, auditId) {
  return request(`/audits/${auditId}/referenced-answers`, { token: session.token });
}

export function createEvidencePackage(session, auditId) {
  return request(`/audits/${auditId}/evidence-packages`, { token: session.token, method: 'POST' });
}

export function listEvidencePackages(session, auditId) {
  return request(`/audits/${auditId}/evidence-packages`, { token: session.token });
}

export function generateReferencedAnswer(session, auditId, questionId, question, refresh = false) {
  return request(`/audits/${auditId}/questions/${encodeURIComponent(questionId)}/answer`, {
    token: session.token,
    method: 'POST',
    body: { question, refresh },
  });
}

export async function downloadDocument(session, auditId, documentId) {
  const response = await fetch(`/api/audits/${auditId}/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'The document could not be downloaded.');
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || 'policy-document';
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadEvidencePackage(session, auditId, packageId) {
  const response = await fetch(`/api/audits/${auditId}/evidence-packages/${packageId}/download`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'The evidence package could not be downloaded.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `evidence-package-${packageId}.zip`;
  link.click();
  URL.revokeObjectURL(url);
}