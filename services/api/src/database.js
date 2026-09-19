import pg from 'pg';

const { Pool } = pg;

export function createDatabase(databaseUrl) {
  return new Pool({ connectionString: databaseUrl });
}