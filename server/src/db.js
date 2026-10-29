import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true'
    ? { rejectUnauthorized: true, ...(process.env.PGSSL_CA ? { ca: process.env.PGSSL_CA.replace(/\\n/g, '\n') } : {}) }
    : false,
  max: Number(process.env.PG_POOL_MAX || 5),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export function assertDatabaseConfigured() {
  if (!process.env.DATABASE_URL) {
    throw Object.assign(new Error('O Vercel ainda não tem DATABASE_URL configurada. Adicione a conexão do PostgreSQL nas variáveis de ambiente e publique novamente.'), {
      status: 503,
      expose: true,
    });
  }
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

