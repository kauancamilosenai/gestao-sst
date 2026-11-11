import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { assertDatabaseConfigured, pool } from './db.js';

export async function initializeSchema() {
  assertDatabaseConfigured();
  const schemaUrl = new URL('../db/schema.sql', import.meta.url);
  const sql = await readFile(fileURLToPath(schemaUrl), 'utf8');
  await pool.query(sql);
  console.log('Estrutura PostgreSQL criada/atualizada.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { await initializeSchema(); }
  finally { await pool.end(); }
}

