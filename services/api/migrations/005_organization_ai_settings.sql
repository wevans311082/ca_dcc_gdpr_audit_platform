CREATE TABLE organization_ai_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  openai_api_key_ciphertext TEXT,
  answer_model TEXT NOT NULL DEFAULT 'gpt-4.1-mini',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);