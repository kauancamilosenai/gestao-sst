import 'dotenv/config';
import { app } from './app.js';
import { pool } from './db.js';
import { initializeSchema } from './init-db.js';
import { bootstrapAdmin } from './auth.js';

const port = Number(process.env.PORT || 3000);
await initializeSchema();
await bootstrapAdmin();
const server = app.listen(port, '0.0.0.0', () => console.log(`Gestão SST API em http://0.0.0.0:${port}`));
async function shutdown() { server.close(async () => { await pool.end(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

