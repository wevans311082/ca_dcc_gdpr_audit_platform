import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function encryptionKey(secret) {
  return createHash('sha256').update(`organization-ai-settings:${secret}`).digest();
}

export function encryptSecret(value, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(value, secret) {
  if (!value) return null;
  const [encodedIv, encodedTag, encodedValue] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), Buffer.from(encodedIv, 'base64url'));
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export async function resolveOrganizationAiConfig(database, config, organizationId) {
  const result = await database.query(
    'SELECT openai_api_key_ciphertext, answer_model FROM organization_ai_settings WHERE organization_id = $1',
    [organizationId],
  );
  const saved = result.rows[0];
  let storedKey = null;
  let keyError = null;
  if (saved?.openai_api_key_ciphertext) {
    try {
      storedKey = decryptSecret(saved.openai_api_key_ciphertext, config.jwtSecret);
    } catch {
      // A rotated JWT secret makes existing ciphertext unreadable. Keep local
      // workspace functionality available and let administrators replace it.
      keyError = 'The saved OpenAI key could not be decrypted. Replace the key in AI settings.';
    }
  }
  return {
    ...config,
    openAiApiKey: storedKey || config.openAiApiKey,
    openAiAnswerModel: saved?.answer_model || config.openAiAnswerModel,
    openAiKeyError: keyError,
  };
}
