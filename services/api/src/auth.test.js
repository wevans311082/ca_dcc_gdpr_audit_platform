import { describe, expect, it } from 'vitest';
import { authenticateUser, registerUserAndOrganization } from './auth.js';
import { hashPassword } from './passwords.js';

async function createDatabase({ email = 'admin@example.test', passwordHash, memberships }) {
  const calls = [];
  return {
    calls,
    async query(sql) {
      calls.push(sql);
      if (sql.includes('FROM users WHERE email')) {
        return { rows: [{ id: 'user-1', email, display_name: 'Workspace Admin', password_hash: passwordHash }] };
      }
      if (sql.includes('FROM organization_memberships')) return { rows: memberships, rowCount: memberships.length };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
}

describe('workspace authentication', () => {
  it('returns workspace choices only after password verification', async () => {
    const database = await createDatabase({
      passwordHash: await hashPassword('correct-horse-battery'),
      memberships: [
        { organization_id: 'org-a', organization_name: 'A Workspace', role: 'org_admin' },
        { organization_id: 'org-b', organization_name: 'B Workspace', role: 'viewer' },
      ],
    });

    const invalid = await authenticateUser(database, { email: 'admin@example.test', password: 'wrong-password' });
    expect(invalid).toBeNull();
    expect(database.calls).toHaveLength(1);

    const authenticated = await authenticateUser(database, { email: 'admin@example.test', password: 'correct-horse-battery' });
    expect(authenticated.organizations).toEqual([
      { id: 'org-a', name: 'A Workspace' },
      { id: 'org-b', name: 'B Workspace' },
    ]);
  });

  it('returns the selected workspace and role after verification', async () => {
    const database = await createDatabase({
      passwordHash: await hashPassword('correct-horse-battery'),
      memberships: [
        { organization_id: 'org-a', organization_name: 'A Workspace', role: 'org_admin' },
        { organization_id: 'org-b', organization_name: 'B Workspace', role: 'viewer' },
      ],
    });

    const authenticated = await authenticateUser(database, {
      email: 'admin@example.test', password: 'correct-horse-battery', organizationId: 'org-b',
    });
    expect(authenticated.organization).toEqual({ id: 'org-b', name: 'B Workspace' });
    expect(authenticated.role).toBe('viewer');
  });

  it('lets an existing account bootstrap another workspace without changing its identity', async () => {
    const passwordHash = await hashPassword('correct-horse-battery');
    const statements = [];
    const database = {
      async connect() {
        return {
          async query(sql) {
            statements.push(sql);
            if (sql.includes('FROM users WHERE email')) {
              return { rows: [{ id: 'user-1', email: 'admin@example.test', display_name: 'Workspace Admin', password_hash: passwordHash }], rowCount: 1 };
            }
            if (sql.includes('INSERT INTO organizations')) return { rows: [{ id: 'org-new', name: 'New Workspace' }], rowCount: 1 };
            if (sql.includes('INSERT INTO organization_memberships')) return { rows: [], rowCount: 1 };
            return { rows: [], rowCount: 0 };
          },
          release() {},
        };
      },
    };

    const account = await registerUserAndOrganization(database, {
      email: 'ADMIN@example.test',
      password: 'correct-horse-battery',
      organizationName: 'New Workspace',
    });

    expect(account.user).toEqual({ id: 'user-1', email: 'admin@example.test', display_name: 'Workspace Admin' });
    expect(account.organization).toEqual({ id: 'org-new', name: 'New Workspace' });
    expect(account.role).toBe('org_admin');
    expect(statements.some((sql) => sql.includes('INSERT INTO users'))).toBe(false);
  });
});