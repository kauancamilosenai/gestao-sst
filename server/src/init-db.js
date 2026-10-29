import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

try {
  const schemaUrl = new URL('../db/schema.sql', import.meta.url);
  const sql = await readFile(fileURLToPath(schemaUrl), 'utf8');
  await pool.query(sql);
  console.log('Estrutura PostgreSQL criada/atualizada.');
} finally { await pool.end(); }
