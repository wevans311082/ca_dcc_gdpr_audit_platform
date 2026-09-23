export function createMembershipGuard(database) {
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
  };
}