const bearerAuth = [{ bearerAuth: [] }];

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'DCC GDPR Audit Platform API',
    version: '1.0.0',
    description: 'Workspace, assessment, document ingestion, evidence package, and administration endpoints.',
  },
  servers: [{ url: '/' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    responses: {
      Unauthorized: { description: 'A valid workspace bearer token is required.' },
      Forbidden: { description: 'The current role cannot perform this operation.' },
    },
  },
  paths: {
    '/api/health': { get: { summary: 'Liveness check', responses: { 200: { description: 'API is running.' } } } },
    '/api/ready': { get: { summary: 'Dependency readiness', responses: { 200: { description: 'Dependencies are ready.' }, 503: { description: 'One or more dependencies are unavailable.' } } } },
    '/api/auth/register': { post: { summary: 'Bootstrap a workspace and its first administrator', responses: { 201: { description: 'Workspace created.' } } } },
    '/api/auth/login': { post: { summary: 'Sign in and select a workspace after password verification', responses: { 200: { description: 'Session token or verified workspace choices returned.' }, 401: { description: 'Credentials were rejected.' } } } },
    '/api/audits': {
      get: { summary: 'List workspace audits', security: bearerAuth, responses: { 200: { description: 'Audit list.' } } },
      post: { summary: 'Create an audit', security: bearerAuth, responses: { 201: { description: 'Audit created.' } } },
    },
    '/api/audits/{auditId}': { get: { summary: 'Get audit and assessment answers', security: bearerAuth, responses: { 200: { description: 'Audit details.' }, 404: { description: 'Audit not found.' } } } },
    '/api/audits/{auditId}/scope': { put: { summary: 'Save audit scope', security: bearerAuth, responses: { 200: { description: 'Scope saved.' } } } },
    '/api/audits/{auditId}/assessments/{questionId}': { put: { summary: 'Save an assessment response', security: bearerAuth, responses: { 200: { description: 'Assessment saved.' } } } },
    '/api/audits/{auditId}/documents': {
      get: { summary: 'List audit documents', security: bearerAuth, responses: { 200: { description: 'Document list.' } } },
      post: { summary: 'Upload a document', security: bearerAuth, responses: { 201: { description: 'Document accepted for ingestion.' } } },
    },
    '/api/audits/{auditId}/documents/{documentId}/download': { get: { summary: 'Download the current document version', security: bearerAuth, responses: { 200: { description: 'Document content.' } } } },
    '/api/audits/{auditId}/documents/{documentId}/replace': { post: { summary: 'Upload a new document version', security: bearerAuth, responses: { 201: { description: 'Replacement accepted for ingestion.' } } } },
    '/api/audits/{auditId}/documents/{documentId}/retry': { post: { summary: 'Retry document ingestion', security: bearerAuth, responses: { 202: { description: 'Ingestion retry queued.' } } } },
    '/api/audits/{auditId}/documents/{documentId}': { delete: { summary: 'Soft-delete an audit document', security: bearerAuth, responses: { 204: { description: 'Document deleted.' } } } },
    '/api/audits/{auditId}/questions/{questionId}/answer': {
      get: { summary: 'Get the latest referenced answer', security: bearerAuth, responses: { 200: { description: 'Answer and citations.' } } },
      post: { summary: 'Generate a cited answer from indexed policies', security: bearerAuth, responses: { 200: { description: 'Generated answer.' }, 503: { description: 'AI provider is not configured.' } } },
    },
    '/api/audits/{auditId}/referenced-answers': { get: { summary: 'List referenced answers for an audit', security: bearerAuth, responses: { 200: { description: 'Answer list.' } } } },
    '/api/audits/{auditId}/evidence-packages': {
      get: { summary: 'List evidence packages', security: bearerAuth, responses: { 200: { description: 'Package list.' } } },
      post: { summary: 'Prepare an evidence package', security: bearerAuth, responses: { 202: { description: 'Package preparation queued.' } } },
    },
    '/api/workspace/ai-capability': { get: { summary: 'Read workspace AI availability without secret values', security: bearerAuth, responses: { 200: { description: 'AI availability and selected model.' } } } },
    '/api/admin/ai-settings': {
      get: { summary: 'Read organization AI settings (secret is masked)', security: bearerAuth, responses: { 200: { description: 'AI settings.' }, 403: { $ref: '#/components/responses/Forbidden' } } },
      put: { summary: 'Save organization API key and answer model', security: bearerAuth, responses: { 200: { description: 'Settings saved.' }, 403: { $ref: '#/components/responses/Forbidden' } } },
    },
    '/api/admin/ai-settings/test': { post: { summary: 'Validate an API key and list available models', security: bearerAuth, responses: { 200: { description: 'Credential check and available model IDs.' }, 422: { description: 'Provider rejected the credential.' } } } },
    '/api/admin/documents': { get: { summary: 'Review uploaded files across workspace audits', security: bearerAuth, responses: { 200: { description: 'Upload inventory and latest ingestion status.' }, 403: { $ref: '#/components/responses/Forbidden' } } } },
    '/api/admin/workspace': {
      get: { summary: 'Read current workspace settings', security: bearerAuth, responses: { 200: { description: 'Workspace identity.' } } },
      patch: { summary: 'Rename the current workspace', security: bearerAuth, responses: { 200: { description: 'Workspace renamed.' } } },
      delete: { summary: 'Permanently delete this workspace and its data after exact-name confirmation', security: bearerAuth, responses: { 204: { description: 'Workspace and associated data deleted.' }, 400: { description: 'Confirmation name did not match.' } } },
    },
    '/api/admin/members': {
      get: { summary: 'List current workspace members', security: bearerAuth, responses: { 200: { description: 'Member list.' } } },
      post: { summary: 'Create or add a user to this workspace', security: bearerAuth, responses: { 201: { description: 'Member added.' }, 409: { description: 'User is already a member.' } } },
    },
    '/api/admin/members/{userId}': {
      patch: { summary: 'Change a workspace member role', security: bearerAuth, responses: { 200: { description: 'Role updated.' }, 409: { description: 'Workspace must retain an administrator.' } } },
      delete: { summary: 'Remove membership without deleting the user account', security: bearerAuth, responses: { 204: { description: 'Membership removed.' }, 409: { description: 'Workspace must retain an administrator.' } } },
    },
  },
};