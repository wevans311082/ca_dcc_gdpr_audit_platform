import { hashPassword, verifyPassword } from './passwords.js';

function requireText(value, fieldName, minimumLength = 1) {
  if (typeof value !== 'string' || value.trim().length < minimumLength) {
    throw new Error(`${fieldName} must be at least ${minimumLength} character${minimumLength === 1 ? '' : 's'} long.`);
  }
  return value.trim();
}

function normalizeEmail(email) {
  const normalized = requireText(email, 'Email').toLowerCase();
  if (!normalized.includes('@')) throw new Error('Email must be valid.');
  return normalized;
}

export async function registerUserAndOrganization(database, { email, displayName, password, organizationName }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = requireText(password, 'Password', 12);
  const client = await database.connect();

  try {
    await client.query('BEGIN');
    let user = await client.query(
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1 FOR UPDATE',
      [normalizedEmail],
    );
    if (user.rowCount > 0) {
      if (!await verifyPassword(normalizedPassword, user.rows[0].password_hash)) {
        throw new Error('An account already exists for this email address. Sign in with its password to create another workspace.');
      }
      user = { rows: [{ id: user.rows[0].id, email: user.rows[0].email, display_name: user.rows[0].display_name }] };
    } else {
      user = await client.query(
        `INSERT INTO users (email, display_name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name`,
        [normalizedEmail, requireText(displayName, 'Display name'), await hashPassword(normalizedPassword)],
      );
    }
    const organization = await client.query(
      'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name',
      [requireText(organizationName, 'Organization name')],
    );
    await client.query(
      `INSERT INTO organization_memberships (organization_id, user_id, role)
       VALUES ($1, $2, 'org_admin')`,
      [organization.rows[0].id, user.rows[0].id],
    );
    await client.query('COMMIT');
    return { user: user.rows[0], organization: organization.rows[0], role: 'org_admin' };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') throw new Error('An account already exists for this email address.', { cause: error });
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateUser(database, { email, password, organizationId }) {
  const userResult = await database.query(
    'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
    [normalizeEmail(email)],
  );
  const user = userResult.rows[0];
  if (!user || !await verifyPassword(requireText(password, 'Password'), user.password_hash)) return null;

  const membershipResult = await database.query(
    `SELECT m.organization_id, m.role, o.name AS organization_name
     FROM organization_memberships m
     JOIN organizations o ON o.id = m.organization_id
     WHERE m.user_id = $1 ORDER BY o.name`,
    [user.id],
  );
  if (membershipResult.rowCount === 0) return null;
  if (!organizationId && membershipResult.rowCount > 1) {
    return {
      user: { id: user.id, email: user.email, displayName: user.display_name },
      organizations: membershipResult.rows.map((membership) => ({ id: membership.organization_id, name: membership.organization_name })),
    };
  }
  const membership = organizationId
    ? membershipResult.rows.find((candidate) => candidate.organization_id === requireText(organizationId, 'Organization'))
    : membershipResult.rows[0];
  if (!membership) return null;

  return {
    user: { id: user.id, email: user.email, displayName: user.display_name },
    organization: { id: membership.organization_id, name: membership.organization_name },
    organizationId: membership.organization_id,
    role: membership.role,
  };
}