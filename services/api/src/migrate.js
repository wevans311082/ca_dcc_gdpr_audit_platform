import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase } from './database.js';
import { loadConfig } from './config.js';

const migrationDirectory = join(dirname(fileURLToPath(import.meta.url)), '../migrations');

async function migrate() {
  const config = loadConfig();
  const database = createDatabase(config.databaseUrl);

  try {
    await database.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationFiles = (await readdir(migrationDirectory))
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort();

    for (const fileName of migrationFiles) {
      const existing = await database.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [fileName],
      );
      if (existing.rowCount > 0) continue;

      await database.query('BEGIN');
      try {
        await database.query(await readFile(join(migrationDirectory, fileName), 'utf8'));
        await database.query('INSERT INTO schema_migrations (name) VALUES ($1)', [fileName]);
        await database.query('COMMIT');
        console.info(`Applied migration ${fileName}`);
      } catch (error) {
        await database.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await database.end();
  }
}

migrate().catch((error) => {
  console.error('Database migration failed.', error);
  process.exit(1);
});