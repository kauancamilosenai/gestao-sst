import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// When SSL options are supplied separately, node-postgres lets SSL query
// parameters in the connection string replace that configuration. Supabase
// URLs commonly include sslmode=require, which would discard PGSSL_CA.
const connectionString = process.env.DATABASE_URL;
let poolConnectionString = connectionString;
if (connectionString && process.env.PGSSL === 'true') {
  const databaseUrl = new URL(connectionString);
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    databaseUrl.searchParams.delete(parameter);
  }
  poolConnectionString = databaseUrl.toString();
}

export const pool = new Pool({
  connectionString: poolConnectionString,
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

