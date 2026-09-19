import { createHash } from 'node:crypto';

const collectionName = 'audit_document_chunks';
const promptVersion = 'policy-rag-v1';

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`RAG dependency returned ${response.status}.`);
  return response.json();
}

function parseModelAnswer(content, chunks) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('OpenAI returned an invalid structured answer.');
  }
  if (typeof parsed.answer !== 'string' || typeof parsed.insufficientEvidence !== 'boolean') {
    throw new Error('OpenAI answer was missing required fields.');
  }
  const allowedIds = new Set(chunks.map((chunk) => chunk.id));
  const citationSourceIds = [...new Set(Array.isArray(parsed.citationSourceIds) ? parsed.citationSourceIds : [])]
    .filter((id) => allowedIds.has(id));
  if (!parsed.insufficientEvidence && citationSourceIds.length === 0) {
    throw new Error('OpenAI returned an answer without valid policy citations.');
  }
  return {
    answer: parsed.answer.trim(),
    policyReferences: Array.isArray(parsed.policyReferences) ? parsed.policyReferences.filter((value) => typeof value === 'string') : [],
    citationSourceIds,
    insufficientEvidence: parsed.insufficientEvidence,
    limitations: typeof parsed.limitations === 'string' ? parsed.limitations.trim() : null,
  };
}

export async function getCorpusVersion(database, organizationId, auditId) {
  const sources = await database.query(
    `SELECT v.id, v.sha256 FROM document_versions v
     JOIN documents d ON d.id = v.document_id
     WHERE d.organization_id = $1 AND d.audit_id = $2 AND d.deleted_at IS NULL
       AND d.status = 'indexed' AND v.superseded_at IS NULL
     ORDER BY v.id`,
    [organizationId, auditId],
  );
  return createHash('sha256').update(sources.rows.map(({ id, sha256 }) => `${id}:${sha256}`).join('|')).digest('hex');
}

async function embedQuestion(config, question) {
  const response = await requestJson(`${config.ollamaBaseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaEmbeddingModel, input: [question] }),
  });
  if (!response.embeddings?.[0]) throw new Error('Ollama did not return a question embedding.');
  return response.embeddings[0];
}

async function retrieveChunks(config, database, organizationId, auditId, question) {
  const vector = await embedQuestion(config, question);
  const response = await requestJson(`${config.qdrantUrl}/collections/${collectionName}/points/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: vector,
      limit: config.ragResultLimit,
      with_payload: false,
      filter: { must: [
        { key: 'organizationId', match: { value: organizationId } },
        { key: 'auditId', match: { value: auditId } },
      ] },
    }),
  });
  const results = (response.result?.points || []).filter((result) => result.score >= config.ragMinimumScore);
  if (results.length === 0) return [];
  const ids = results.map((result) => result.id);
  const chunks = await database.query(
    `SELECT c.id, c.content, c.page_number, c.section_heading, d.id AS document_id, d.title, v.version_number
     FROM document_chunks c
     JOIN document_versions v ON v.id = c.document_version_id AND v.superseded_at IS NULL
     JOIN documents d ON d.id = v.document_id AND d.deleted_at IS NULL AND d.status = 'indexed'
     WHERE c.organization_id = $1 AND c.audit_id = $2 AND c.id = ANY($3::uuid[])`,
    [organizationId, auditId, ids],
  );
  const scores = new Map(results.map((result) => [result.id, result.score]));
  return chunks.rows
    .filter((chunk) => scores.has(chunk.id))
    .map((chunk) => ({ ...chunk, score: scores.get(chunk.id) }))
    .sort((first, second) => second.score - first.score);
}

async function synthesizeAnswer(config, question, chunks) {
  const context = chunks.map((chunk) => [
    `SOURCE_ID: ${chunk.id}`,
    `DOCUMENT: ${chunk.title}, version ${chunk.version_number}`,
    `LOCATION: ${chunk.page_number ? `page ${chunk.page_number}` : chunk.section_heading || 'section unavailable'}`,
    `EXCERPT: ${chunk.content}`,
  ].join('\n')).join('\n\n');
  const response = await requestJson('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openAiApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openAiAnswerModel,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a DCC readiness assistant. Answer only from the supplied policy excerpts. Never invent a policy reference, document, page, or source ID. If evidence does not support the question, set insufficientEvidence to true and explain what evidence is missing. This is readiness guidance, not legal advice or a certification decision. Return JSON with answer, policyReferences, citationSourceIds, insufficientEvidence, and limitations.',
        },
        { role: 'user', content: `QUESTION:\n${question}\n\nPOLICY EXCERPTS:\n${context}` },
      ],
    }),
  });
  return parseModelAnswer(response.choices?.[0]?.message?.content, chunks);
}

async function persistAnswer(database, { organizationId, auditId, questionId, corpusVersion, config, answer, chunks }) {
  const citedChunks = chunks.filter((chunk) => answer.citationSourceIds.includes(chunk.id));
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE answer_generations SET status = 'stale', invalidated_at = now()
       WHERE organization_id = $1 AND audit_id = $2 AND question_id = $3 AND status = 'current'`,
      [organizationId, auditId, questionId],
    );
    const generated = await client.query(
      `INSERT INTO answer_generations (organization_id, audit_id, question_id, corpus_version, prompt_version, model, answer, policy_references, limitations, insufficient_evidence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, created_at`,
      [organizationId, auditId, questionId, corpusVersion, promptVersion, config.openAiAnswerModel, answer.answer, JSON.stringify(answer.policyReferences), answer.limitations, answer.insufficientEvidence],
    );
    for (const chunk of citedChunks) {
      await client.query(
        `INSERT INTO answer_citations (answer_generation_id, document_chunk_id, relevance_score, excerpt)
         VALUES ($1, $2, $3, $4)`,
        [generated.rows[0].id, chunk.id, chunk.score, chunk.content.slice(0, 600)],
      );
    }
    await client.query('COMMIT');
    return { id: generated.rows[0].id, createdAt: generated.rows[0].created_at };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getCurrentAnswer(database, organizationId, auditId, questionId, corpusVersion) {
  const answer = await database.query(
    `SELECT id, answer, policy_references, limitations, insufficient_evidence, model, status, created_at
     FROM answer_generations WHERE organization_id = $1 AND audit_id = $2 AND question_id = $3
       AND corpus_version = $4 AND prompt_version = $5 AND status = 'current'
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, auditId, questionId, corpusVersion, promptVersion],
  );
  if (answer.rowCount === 0) return null;
  const citations = await database.query(
    `SELECT c.relevance_score, c.excerpt, d.title, v.version_number, dc.page_number, dc.section_heading
     FROM answer_citations c
     JOIN document_chunks dc ON dc.id = c.document_chunk_id
     JOIN document_versions v ON v.id = dc.document_version_id
     JOIN documents d ON d.id = v.document_id
     WHERE c.answer_generation_id = $1 ORDER BY c.relevance_score DESC`,
    [answer.rows[0].id],
  );
  return { ...answer.rows[0], citations: citations.rows };
}

export async function getLatestAnswer(database, organizationId, auditId, questionId, corpusVersion) {
  const answer = await database.query(
    `SELECT id, answer, policy_references, limitations, insufficient_evidence, model, status, corpus_version, created_at
     FROM answer_generations WHERE organization_id = $1 AND audit_id = $2 AND question_id = $3
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, auditId, questionId],
  );
  if (answer.rowCount === 0) return null;
  const citations = await database.query(
    `SELECT c.relevance_score, c.excerpt, d.title, v.version_number, dc.page_number, dc.section_heading,
            CASE WHEN d.deleted_at IS NULL AND v.superseded_at IS NULL THEN 'available' ELSE 'unavailable' END AS source_status
     FROM answer_citations c
     JOIN document_chunks dc ON dc.id = c.document_chunk_id
     JOIN document_versions v ON v.id = dc.document_version_id
     JOIN documents d ON d.id = v.document_id
     WHERE c.answer_generation_id = $1 ORDER BY c.relevance_score DESC`,
    [answer.rows[0].id],
  );
  return {
    ...answer.rows[0],
    status: answer.rows[0].status === 'current' && answer.rows[0].corpus_version === corpusVersion ? 'current' : 'stale',
    generatedAt: answer.rows[0].created_at,
    citations: citations.rows,
  };
}

export async function getLatestAnswers(database, organizationId, auditId, corpusVersion) {
  const answers = await database.query(
    `SELECT DISTINCT ON (question_id) id, question_id, answer, policy_references, limitations, insufficient_evidence,
            model, status, corpus_version, created_at
     FROM answer_generations
     WHERE organization_id = $1 AND audit_id = $2
     ORDER BY question_id, created_at DESC`,
    [organizationId, auditId],
  );
  if (answers.rowCount === 0) return [];
  const answerIds = answers.rows.map((answer) => answer.id);
  const citations = await database.query(
    `SELECT c.answer_generation_id, c.relevance_score, c.excerpt, d.title, v.version_number, dc.page_number, dc.section_heading,
            CASE WHEN d.deleted_at IS NULL AND v.superseded_at IS NULL THEN 'available' ELSE 'unavailable' END AS source_status
     FROM answer_citations c
     JOIN document_chunks dc ON dc.id = c.document_chunk_id
     JOIN document_versions v ON v.id = dc.document_version_id
     JOIN documents d ON d.id = v.document_id
     WHERE c.answer_generation_id = ANY($1::uuid[])
     ORDER BY c.answer_generation_id, c.relevance_score DESC`,
    [answerIds],
  );
  const citationsByAnswerId = new Map();
  citations.rows.forEach(({ answer_generation_id: answerId, ...citation }) => {
    const grouped = citationsByAnswerId.get(answerId) || [];
    grouped.push(citation);
    citationsByAnswerId.set(answerId, grouped);
  });
  return answers.rows.map((answer) => ({
    ...answer,
    status: answer.status === 'current' && answer.corpus_version === corpusVersion ? 'current' : 'stale',
    generatedAt: answer.created_at,
    citations: citationsByAnswerId.get(answer.id) || [],
  }));
}

export async function generateCitedAnswer({ config, database, organizationId, auditId, questionId, question }) {
  const corpusVersion = await getCorpusVersion(database, organizationId, auditId);
  const chunks = await retrieveChunks(config, database, organizationId, auditId, question);
  if (chunks.length === 0) {
    return { answer: null, corpusVersion, insufficientEvidence: true, limitations: 'No sufficiently relevant indexed policy evidence was found.', citations: [] };
  }
  const answer = await synthesizeAnswer(config, question, chunks);
  const persisted = await persistAnswer(database, { organizationId, auditId, questionId, corpusVersion, config, answer, chunks });
  return { ...answer, ...persisted, status: 'current', corpusVersion, citations: chunks.filter((chunk) => answer.citationSourceIds.includes(chunk.id)).map((chunk) => ({
    title: chunk.title, version_number: chunk.version_number, page_number: chunk.page_number, section_heading: chunk.section_heading,
    excerpt: chunk.content.slice(0, 600), relevance_score: chunk.score,
  })) };
}