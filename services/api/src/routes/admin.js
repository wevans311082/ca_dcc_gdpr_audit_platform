import { Queue } from 'bullmq';
import { QDRANT_DOCUMENT_CHUNK_COLLECTION } from '@ca-dcc/shared';
import { hashPassword } from '../passwords.js';
import { encryptSecret, resolveOrganizationAiConfig } from '../secretStorage.js';

const memberRoles = new Set(['org_admin', 'assessor', 'viewer']);
const pendingJobStates = ['waiting', 'delayed', 'paused', 'prioritized'];

function requireAdmin(database) {
  return async (request, reply) => {
    await request.jwtVerify();
    if (!request.user.organizationId || !request.user.sub) {
      return reply.code(401).send({ error: 'Invalid session.' });
    }
    const membership = await database.query(
      `SELECT role FROM organization_memberships
       WHERE organization_id = $1 AND user_id = $2`,
      [request.user.organizationId, request.user.sub],
    );
    if (membership.rowCount === 0) return reply.code(403).send({ error: 'Workspace membership is no longer active.' });
    request.user.role = membership.rows[0].role;
    if (request.user.role !== 'org_admin') {
      return reply.code(403).send({ error: 'Organization administrator access is required.' });
    }
  };
}

function requireText(value, label, minimumLength = 1) {
  if (typeof value !== 'string' || value.trim().length < minimumLength) {
    throw new Error(`${label} must be at least ${minimumLength} character${minimumLength === 1 ? '' : 's'} long.`);
  }
  return value.trim();
}

function normalizeEmail(value) {
  const email = requireText(value, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email must be valid.');
  return email;
}

async function waitForQueuesToDrain(queues) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const activeCounts = await Promise.all(queues.map((queue) => queue.getActiveCount()));
    if (activeCounts.every((count) => count === 0)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Background jobs are still running. Wait for them to finish, then retry workspace deletion.');
}

async function removeWorkspacePendingJobs(queue, organizationId) {
  const jobs = await queue.getJobs(pendingJobStates);
  for (const job of jobs) {
    if (job.data.organizationId === organizationId) await job.remove();
  }
}

async function deleteWorkspaceVectors(qdrantUrl, organizationId) {
  const response = await fetch(
    `${qdrantUrl.replace(/\/$/, '')}/collections/${QDRANT_DOCUMENT_CHUNK_COLLECTION}/points/delete?wait=true`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filter: { must: [{ key: 'organizationId', match: { value: organizationId } }] } }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok && response.status !== 404) throw new Error(`Qdrant workspace cleanup returned ${response.status}.`);
}

async function fetchModels(apiKey) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `OpenAI returned ${response.status}.`);
  return (result.data || []).map((model) => model.id).filter(Boolean).sort();
}

async function readSettings(database, config, organizationId) {
  const resolved = await resolveOrganizationAiConfig(database, config, organizationId);
  const organizationSettings = await database.query(
    'SELECT openai_api_key_ciphertext FROM organization_ai_settings WHERE organization_id = $1',
    [organizationId],
  );
  return {
    apiKey: resolved.openAiApiKey,
    answerModel: resolved.openAiAnswerModel,
    configuredByOrganization: Boolean(organizationSettings.rows[0]?.openai_api_key_ciphertext),
  };
}

export async function adminRoutes(app, { config, database, storage }) {
  const adminOnly = requireAdmin(database);
  const ingestionQueue = new Queue('document-ingestion', { connection: { url: config.redisUrl } });
  const packageQueue = new Queue('evidence-package', { connection: { url: config.redisUrl } });
  app.addHook('onClose', async () => {
    await Promise.all([ingestionQueue.close(), packageQueue.close()]);
  });

  app.get('/api/workspace/ai-capability', async (request, reply) => {
    await request.jwtVerify();
    if (!request.user.organizationId || !request.user.sub) {
      return reply.code(401).send({ error: 'Invalid session.' });
    }
    const settings = await resolveOrganizationAiConfig(database, config, request.user.organizationId);
    return { openAiConfigured: Boolean(settings.openAiApiKey), answerModel: settings.openAiAnswerModel };
  });

  app.get('/api/admin/ai-settings', { preHandler: adminOnly }, async (request) => {
    const settings = await readSettings(database, config, request.user.organizationId);
    return {
      configured: Boolean(settings.apiKey),
      configuredByOrganization: settings.configuredByOrganization,
      maskedApiKey: settings.apiKey ? `••••••••${settings.apiKey.slice(-4)}` : '',
      answerModel: settings.answerModel,
    };
  });

  app.put('/api/admin/ai-settings', { preHandler: adminOnly }, async (request, reply) => {
    const { apiKey, answerModel, clearApiKey = false } = request.body || {};
    if (typeof answerModel !== 'string' || !answerModel.trim() || answerModel.length > 200) {
      return reply.code(400).send({ error: 'Choose a valid answer model.' });
    }
    if (apiKey !== undefined && typeof apiKey !== 'string') {
      return reply.code(400).send({ error: 'API key must be text.' });
    }
    if (typeof clearApiKey !== 'boolean') {
      return reply.code(400).send({ error: 'clearApiKey must be a boolean.' });
    }

    const current = await database.query(
      'SELECT openai_api_key_ciphertext FROM organization_ai_settings WHERE organization_id = $1',
      [request.user.organizationId],
    );
    const nextKey = clearApiKey
      ? null
      : apiKey?.trim()
        ? encryptSecret(apiKey.trim(), config.jwtSecret)
        : current.rows[0]?.openai_api_key_ciphertext || null;
    await database.query(
      `INSERT INTO organization_ai_settings (organization_id, openai_api_key_ciphertext, answer_model, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id) DO UPDATE SET
         openai_api_key_ciphertext = EXCLUDED.openai_api_key_ciphertext,
         answer_model = EXCLUDED.answer_model, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [request.user.organizationId, nextKey, answerModel.trim(), request.user.sub],
    );
    return { saved: true, configured: Boolean(nextKey || config.openAiApiKey), answerModel: answerModel.trim() };
  });

  app.post('/api/admin/ai-settings/test', { preHandler: adminOnly }, async (request, reply) => {
    const { apiKey, answerModel } = request.body || {};
    const saved = await readSettings(database, config, request.user.organizationId);
    const candidateKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : saved.apiKey;
    if (!candidateKey) return reply.code(400).send({ error: 'Enter an API key before testing.' });
    try {
      const models = await fetchModels(candidateKey);
      return {
        valid: true,
        modelAvailable: typeof answerModel === 'string' ? models.includes(answerModel) : null,
        models: models.filter((model) => (
          /^(gpt-|chatgpt-|o1(?:-|$)|o3(?:-|$)|o4(?:-|$))/i.test(model)
          && !/(audio|realtime|transcribe|tts|embedding|whisper|moderation)/i.test(model)
        )),
      };
    } catch (error) {
      request.log.warn({ error: error.message }, 'OpenAI credential test failed.');
      return reply.code(422).send({ valid: false, error: error.message || 'OpenAI credential validation failed.' });
    }
  });

  app.get('/api/admin/documents', { preHandler: adminOnly }, async (request) => {
    const result = await database.query(
      `SELECT d.id, d.audit_id, a.title AS audit_title, d.title, d.document_type, d.status,
              d.created_at, d.updated_at, d.deleted_at, u.display_name AS uploaded_by,
              v.version_id, v.version_number, v.original_filename, v.content_type, v.byte_size,
              v.sha256, v.version_created_at, j.ingestion_status, j.error_message
       FROM documents d
       JOIN audits a ON a.id = d.audit_id
       JOIN users u ON u.id = d.created_by
       LEFT JOIN LATERAL (
         SELECT id AS version_id, version_number, original_filename, content_type, byte_size,
                sha256, created_at AS version_created_at
         FROM document_versions WHERE document_id = d.id
         ORDER BY version_number DESC LIMIT 1
       ) v ON true
       LEFT JOIN LATERAL (
         SELECT status AS ingestion_status, error_message FROM ingestion_jobs
         WHERE document_id = d.id ORDER BY created_at DESC LIMIT 1
       ) j ON true
       WHERE d.organization_id = $1
       ORDER BY d.created_at DESC`,
      [request.user.organizationId],
    );
    return { documents: result.rows.map((document) => ({
      ...document,
      byte_size: document.byte_size === null ? null : Number(document.byte_size),
    })) };
  });

  app.get('/api/admin/workspace', { preHandler: adminOnly }, async (request, reply) => {
    const result = await database.query(
      'SELECT id, name, created_at FROM organizations WHERE id = $1',
      [request.user.organizationId],
    );
    if (result.rowCount === 0) return reply.code(404).send({ error: 'Workspace not found.' });
    return { workspace: result.rows[0] };
  });

  app.patch('/api/admin/workspace', { preHandler: adminOnly }, async (request, reply) => {
    try {
      const name = requireText(request.body?.name, 'Workspace name', 2);
      const result = await database.query(
        `UPDATE organizations SET name = $1, updated_at = now()
         WHERE id = $2 RETURNING id, name, created_at`,
        [name, request.user.organizationId],
      );
      if (result.rowCount === 0) return reply.code(404).send({ error: 'Workspace not found.' });
      return { workspace: result.rows[0] };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.get('/api/admin/members', { preHandler: adminOnly }, async (request) => {
    const result = await database.query(
      `SELECT u.id, u.email, u.display_name, m.role, m.created_at AS joined_at
       FROM organization_memberships m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = $1 ORDER BY u.display_name, u.email`,
      [request.user.organizationId],
    );
    return { members: result.rows };
  });

  app.post('/api/admin/members', { preHandler: adminOnly }, async (request, reply) => {
    const { email, displayName, password, role = 'assessor' } = request.body || {};
    if (!memberRoles.has(role)) return reply.code(400).send({ error: 'Choose a valid workspace role.' });
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      const normalizedEmail = normalizeEmail(email);
      let user = await client.query(
        'SELECT id, email, display_name FROM users WHERE email = $1',
        [normalizedEmail],
      );
      if (user.rowCount === 0) {
        const newUser = await client.query(
          `INSERT INTO users (email, display_name, password_hash)
           VALUES ($1, $2, $3) RETURNING id, email, display_name`,
          [normalizedEmail, requireText(displayName, 'Display name'), await hashPassword(requireText(password, 'Password', 12))],
        );
        user = newUser;
      }
      const member = await client.query(
        `INSERT INTO organization_memberships (organization_id, user_id, role)
         VALUES ($1, $2, $3) RETURNING created_at AS joined_at`,
        [request.user.organizationId, user.rows[0].id, role],
      );
      await client.query('COMMIT');
      return reply.code(201).send({ member: { ...user.rows[0], role, joined_at: member.rows[0].joined_at } });
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.code === '23505') return reply.code(409).send({ error: 'This user is already a workspace member.' });
      return reply.code(400).send({ error: error.message });
    } finally {
      client.release();
    }
  });

  app.patch('/api/admin/members/:userId', { preHandler: adminOnly }, async (request, reply) => {
    const { role } = request.body || {};
    if (!memberRoles.has(role)) return reply.code(400).send({ error: 'Choose a valid workspace role.' });
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [request.user.organizationId]);
      const current = await client.query(
        `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2`,
        [request.user.organizationId, request.params.userId],
      );
      if (current.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Workspace member not found.' });
      }
      if (current.rows[0].role === 'org_admin' && role !== 'org_admin') {
        const admins = await client.query(
          `SELECT count(*)::int AS count FROM organization_memberships
           WHERE organization_id = $1 AND role = 'org_admin'`,
          [request.user.organizationId],
        );
        if (admins.rows[0].count <= 1) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'A workspace must retain at least one administrator.' });
        }
      }
      const result = await client.query(
        `UPDATE organization_memberships SET role = $1
         WHERE organization_id = $2 AND user_id = $3 RETURNING role`,
        [role, request.user.organizationId, request.params.userId],
      );
      await client.query('COMMIT');
      return { userId: request.params.userId, role: result.rows[0].role };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.delete('/api/admin/members/:userId', { preHandler: adminOnly }, async (request, reply) => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [request.user.organizationId]);
      const membership = await client.query(
        `SELECT role FROM organization_memberships WHERE organization_id = $1 AND user_id = $2`,
        [request.user.organizationId, request.params.userId],
      );
      if (membership.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Workspace member not found.' });
      }
      if (membership.rows[0].role === 'org_admin') {
        const admins = await client.query(
          `SELECT count(*)::int AS count FROM organization_memberships
           WHERE organization_id = $1 AND role = 'org_admin'`,
          [request.user.organizationId],
        );
        if (admins.rows[0].count <= 1) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'Add another administrator before removing the last administrator.' });
        }
      }
      await client.query(
        'DELETE FROM organization_memberships WHERE organization_id = $1 AND user_id = $2',
        [request.user.organizationId, request.params.userId],
      );
      await client.query('COMMIT');
      return reply.code(204).send();
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.delete('/api/admin/workspace', { preHandler: adminOnly }, async (request, reply) => {
    const organizationId = request.user.organizationId;
    const current = await database.query('SELECT name FROM organizations WHERE id = $1', [organizationId]);
    if (current.rowCount === 0) return reply.code(404).send({ error: 'Workspace not found.' });
    if (request.body?.confirmName !== current.rows[0].name) {
      return reply.code(400).send({ error: 'Type the exact workspace name to confirm deletion.' });
    }

    const queues = [ingestionQueue, packageQueue];
    try {
      await Promise.all(queues.map((queue) => queue.pause()));
      await waitForQueuesToDrain(queues);
      await Promise.all(queues.map((queue) => removeWorkspacePendingJobs(queue, organizationId)));

      const [sourceObjects, packageObjects] = await Promise.all([
        database.query(
          `SELECT v.object_key FROM document_versions v JOIN documents d ON d.id = v.document_id
           WHERE d.organization_id = $1`,
          [organizationId],
        ),
        database.query('SELECT package_object_key FROM evidence_packages WHERE organization_id = $1', [organizationId]),
      ]);
      await deleteWorkspaceVectors(config.qdrantUrl, organizationId);
      const objectKeys = new Set([
        ...sourceObjects.rows.map((row) => row.object_key),
        ...packageObjects.rows.map((row) => row.package_object_key).filter(Boolean),
      ]);
      await Promise.all([...objectKeys].map((key) => storage.remove(key)));

      const client = await database.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `DELETE FROM answer_citations WHERE answer_generation_id IN
           (SELECT id FROM answer_generations WHERE organization_id = $1)`,
          [organizationId],
        );
        await client.query('DELETE FROM answer_generations WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM audit_events WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM vector_cleanup_jobs WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM evidence_packages WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM audits WHERE organization_id = $1', [organizationId]);
        await client.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return reply.code(204).send();
    } catch (error) {
      request.log.error({ organizationId, error: error.message }, 'Workspace deletion failed.');
      return reply.code(502).send({ error: error.message || 'Workspace deletion could not be completed.' });
    } finally {
      await Promise.all(queues.map((queue) => queue.resume().catch(() => undefined)));
    }
  });
}