CREATE INDEX answer_generations_cache_idx
  ON answer_generations (organization_id, audit_id, question_id, corpus_version, prompt_version, model, created_at DESC)
  WHERE status = 'current';

CREATE INDEX answer_citations_generation_idx
  ON answer_citations (answer_generation_id);