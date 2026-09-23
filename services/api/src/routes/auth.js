import { authenticateUser, registerUserAndOrganization } from '../auth.js';

export async function authRoutes(app, { database }) {
  app.post('/api/auth/register', async (request, reply) => {
    try {
      const account = await registerUserAndOrganization(database, request.body || {});
      const token = await reply.jwtSign({
        sub: account.user.id,
        organizationId: account.organization.id,
        role: account.role,
      });
      return reply.code(201).send({ ...account, token });
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });

  app.post('/api/auth/login', async (request, reply) => {
    try {
      const account = await authenticateUser(database, request.body || {});
      if (!account) return reply.code(401).send({ error: 'Invalid email, password, or organization.' });
      if (account.organizations) return account;
      const token = await reply.jwtSign({
        sub: account.user.id,
        organizationId: account.organizationId,
        role: account.role,
      });
      return { ...account, token };
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }
  });
}