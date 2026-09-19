import { QDRANT_DOCUMENT_CHUNK_COLLECTION } from '@ca-dcc/shared';

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok && response.status !== 409) {
    throw new Error(`Vector service returned ${response.status}: ${await response.text()}`);
  }
  return response.status === 409 ? null : response.json();
}

export async function embedTexts(config, texts) {
  const response = await requestJson(`${config.ollamaBaseUrl}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.ollamaEmbeddingModel, input: texts }),
  });
  if (!response.embeddings || response.embeddings.length !== texts.length) {
    throw new Error('Ollama returned an unexpected number of embeddings.');
  }
  return response.embeddings;
}

export async function indexChunks(config, chunks, embeddings) {
  if (chunks.length === 0) return;
  await requestJson(`${config.qdrantUrl}/collections/${QDRANT_DOCUMENT_CHUNK_COLLECTION}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vectors: { size: embeddings[0].length, distance: 'Cosine' } }),
  });
  await requestJson(`${config.qdrantUrl}/collections/${QDRANT_DOCUMENT_CHUNK_COLLECTION}/points`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ points: chunks.map((chunk, index) => ({
      id: chunk.id,
      vector: embeddings[index],
      payload: {
        organizationId: chunk.organizationId,
        auditId: chunk.auditId,
        documentId: chunk.documentId,
        documentVersionId: chunk.documentVersionId,
        pageNumber: chunk.pageNumber,
        sectionHeading: chunk.sectionHeading,
        content: chunk.content,
      },
    })) }),
  });
}