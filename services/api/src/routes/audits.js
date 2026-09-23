import { generateCitedAnswer, getCorpusVersion, getCurrentAnswer, getLatestAnswer, getLatestAnswers } from '../ragService.js';
import { resolveOrganizationAiConfig } from '../secretStorage.js';
import { createMembershipGuard } from '../routeAuth.js';

const permittedRoles = new Set(['org_admin', 'assessor']);

function requireText(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${fieldName} is required.`);
  return value.trim();
}

function requireSelectedLevel(value) {
  if (!Number.isInteger(value) || value < 0 || value > 3) throw new Error('Selected level must be an integer between 0 and 3.');
  return value;
}

function requireEditor(request) {
  if (!permittedRoles.has(request.user.role)) throw new Error('Your role cannot modify audits.');
}

export async function auditRoutes(app, { config, database }) {
  const requireMembership = createMembershipGuard(database);
  app.get('/api/audits', { preHandler: requireMembership }, async (request) => {
    const audits = await database.query(
      `SELECT id, title, selected_level, status, scope, attested_at, completed_at, created_at, updated_at
       FROM audits WHERE organization_id = $1 ORDER BY updated_at DESC`,
      [request.user.organizationId],
    );
    return { audits: audits.rows };
  });

  app.post('/api/audits', { preHandler: requireMembership }, async (request, reply) => {
    try {
      requireEditor(request);
      const { title, selectedLevel, questionCatalogueVersion } = request.body || {};
      const audit = await database.query(
        `INSERT INTO audits (organization_id, created_by, title, selected_level, question_catalogue_version, status)
         VALUES ($1, $2, $3, $4, $5, 'in_progress')
         RETURNING id, title, selected_level, question_catalogue_version, status, scope, created_at, updated_at`,
        [
          request.user.organizationId,
          request.user.sub,
          requireText(title, 'Title'),
          requireSelectedLevel(selectedLevel),
          requireText(questionCatalogueVersion, 'Question catalogue version'),
        ],
      );
      return reply.code(201).send({ audit: audit.rows[0] });
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.put('/api/audits/:auditId/scope', { preHandler: requireMembership }, async (request, reply) => {
    try {
      requireEditor(request);
      const { scope = {}, selectedLevel } = request.body || {};
      if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new Error('Scope must be an object.');
      const audit = await database.query(
        `UPDATE audits SET scope = $1, selected_level = $2, updated_at = now()
         WHERE id = $3 AND organization_id = $4
         RETURNING id, selected_level, scope, updated_at`,
        [scope, requireSelectedLevel(selectedLevel), request.params.auditId, request.user.organizationId],
      );
      if (audit.rowCount === 0) return reply.code(404).send({ error: 'Audit not found.' });
      return { audit: audit.rows[0] };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/api/audits/:auditId', { preHandler: requireMembership }, async (request, reply) => {
    const audit = await database.query(
      `SELECT id, title, selected_level, question_catalogue_version, status, scope, attested_at, completed_at, created_at, updated_at
       FROM audits WHERE id = $1 AND organization_id = $2`,
      [request.params.auditId, request.user.organizationId],
    );
    if (audit.rowCount === 0) return reply.code(404).send({ error: 'Audit not found.' });

    const assessments = await database.query(
      'SELECT question_id, status, response, notes, evidence_checklist, updated_at FROM assessments WHERE audit_id = $1',
      [audit.rows[0].id],
    );
    return { audit: audit.rows[0], assessments: assessments.rows };
  });

  app.put('/api/audits/:auditId/assessments/:questionId', { preHandler: requireMembership }, async (request, reply) => {
    try {
      requireEditor(request);
      const { status = 'not-assessed', response = '', notes = '', evidenceChecklist = [] } = request.body || {};
      const assessment = await database.query(
        `INSERT INTO assessments (audit_id, question_id, status, response, notes, evidence_checklist)
         SELECT id, $2, $3, $4, $5, $6 FROM audits WHERE id = $1 AND organization_id = $7
         ON CONFLICT (audit_id, question_id) DO UPDATE SET
           status = EXCLUDED.status, response = EXCLUDED.response, notes = EXCLUDED.notes,
           evidence_checklist = EXCLUDED.evidence_checklist, updated_at = now()
         RETURNING question_id, status, response, notes, evidence_checklist, updated_at`,
        [request.params.auditId, request.params.questionId, status, response, notes, evidenceChecklist, request.user.organizationId],
      );
      if (assessment.rowCount === 0) return reply.code(404).send({ error: 'Audit not found.' });
      return { assessment: assessment.rows[0] };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/api/audits/:auditId/questions/:questionId/answer', { preHandler: requireMembership }, async (request, reply) => {
    const audit = await database.query('SELECT id FROM audits WHERE id = $1 AND organization_id = $2', [request.params.auditId, request.user.organizationId]);
    if (audit.rowCount === 0) return reply.code(404).send({ error: 'Audit not found.' });
    const corpusVersion = await getCorpusVersion(database, request.user.organizationId, request.params.auditId);
    const answer = await getLatestAnswer(database, request.user.organizationId, request.params.auditId, request.params.questionId, corpusVersion);
    const aiConfig = await resolveOrganizationAiConfig(database, config, request.user.organizationId);
    return { answer, answerAvailable: Boolean(aiConfig.openAiApiKey) };
  });

  app.get('/api/audits/:auditId/referenced-answers', { preHandler: requireMembership }, async (request, reply) => {
    const audit = await database.query('SELECT id FROM audits WHERE id = $1 AND organization_id = $2', [request.params.auditId, request.user.organizationId]);
    if (audit.rowCount === 0) return reply.code(404).send({ error: 'Audit not found.' });
    const corpusVersion = await getCorpusVersion(database, request.user.organizationId, request.params.auditId);
    const answers = await getLatestAnswers(database, request.user.organizationId, request.params.auditId, corpusVersion);
    return { answers };
  });

  app.post('/api/audits/:auditId/questions/:questionId/answer', { preHandler: requireMembership }, async (request, reply) => {
    try {
      requireEditor(request);
      const { question, refresh = false } = request.body || {};
      const audit = await database.query('SELECT id FROM audits WHERE id = $1 AND organization_id = $2', [request.params.auditId, request.user.organizationId]);
      if (audit.rowCount === 0) return reply.code(404).send({ error: 'Audit not found.' });
      const aiConfig = await resolveOrganizationAiConfig(database, config, request.user.organizationId);
      if (!aiConfig.openAiApiKey) return reply.code(503).send({ error: 'Referenced answers are not configured for this workspace.' });
      const corpusVersion = await getCorpusVersion(database, request.user.organizationId, request.params.auditId);
      if (!refresh) {
        const cached = await getCurrentAnswer(database, request.user.organizationId, request.params.auditId, request.params.questionId, corpusVersion);
        if (cached) return { answer: cached, cached: true };
      }
      const generated = await generateCitedAnswer({
        config: aiConfig, database, organizationId: request.user.organizationId, auditId: request.params.auditId,
        questionId: request.params.questionId, question: requireText(question, 'Question'),
      });
      return { answer: generated, cached: false };
    } catch (error) {
      request.log.error({ error: error.message, auditId: request.params.auditId, questionId: request.params.questionId }, 'Referenced answer generation failed.');
      return reply.code(502).send({ error: error.message || 'Unable to generate a referenced answer.' });
    }
  });
}