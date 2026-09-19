import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, keyLength);
  return `${salt}:${Buffer.from(derivedKey).toString('hex')}`;
}

export async function verifyPassword(password, storedHash) {
  const [salt, storedKey] = storedHash.split(':');
  if (!salt || !storedKey) return false;

  const derivedKey = await scrypt(password, salt, keyLength);
  const storedBuffer = Buffer.from(storedKey, 'hex');
  const derivedBuffer = Buffer.from(derivedKey);
  return storedBuffer.length === derivedBuffer.length && timingSafeEqual(storedBuffer, derivedBuffer);
}