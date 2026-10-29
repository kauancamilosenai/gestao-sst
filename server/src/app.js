import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDatabaseConfigured, pool, withTransaction } from './db.js';
import { addYears, isISODate } from './dates.js';
import { bootstrapAdmin, registerAuthRoutes } from './auth.js';
import { initializeSchema } from './init-db.js';

export const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
const frontendDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');
app.use(express.static(frontendDir));

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (message) => Object.assign(new Error(message), { status: 400 });
const audit = (client, type, id, action, details = {}) => client.query(
  'INSERT INTO audit_log(entity_type, entity_id, action, details) VALUES($1,$2,$3,$4)', [type, id, action, details]);

let vercelInitialization;
if (process.env.VERCEL) {
  app.use('/api', asyncRoute(async (_req, _res, next) => {
    if (!vercelInitialization) {
      vercelInitialization = (async () => {
        assertDatabaseConfigured();
        await initializeSchema();
        await bootstrapAdmin();
      })().catch((error) => { vercelInitialization = null; throw error; });
    }
    await vercelInitialization;
    next();
  }));
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

registerAuthRoutes(app, asyncRoute, bad);

app.get('/api/contractors', asyncRoute(async (req, res) => {
  const result = await pool.query(`SELECT c.*, count(e.id)::int AS employee_count
    FROM contractors c LEFT JOIN employees e ON e.contractor_id=c.id
    WHERE ($1::text IS NULL OR c.status=$1) GROUP BY c.id ORDER BY c.name`, [req.query.status || null]);
  res.json(result.rows);
}));

app.post('/api/contractors', asyncRoute(async (req, res) => {
  const { name, cnpj = null } = req.body;
  if (!name?.trim()) throw bad('Informe o nome da empreiteira.');
  const result = await withTransaction(async (client) => {
    const { rows: [row] } = await client.query('INSERT INTO contractors(name,cnpj) VALUES($1,$2) RETURNING *', [name.trim(), cnpj]);
    await audit(client, 'contractor', row.id, 'created'); return row;
  });
  res.status(201).json(result);
}));

app.patch('/api/contractors/:id/status', asyncRoute(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) throw bad('Status deve ser active ou inactive.');
  const result = await withTransaction(async (client) => {
    const { rows: [company] } = await client.query('UPDATE contractors SET status=$1,updated_at=now() WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (!company) return null;
    if (status === 'inactive') {
      await client.query("UPDATE employees SET status='inactive',updated_at=now() WHERE contractor_id=$1 AND status='active'", [company.id]);
      await client.query('UPDATE employee_contractor_history SET ended_on=CURRENT_DATE WHERE contractor_id=$1 AND ended_on IS NULL', [company.id]);
    }
    await audit(client, 'contractor', company.id, 'status_changed', { status }); return company;
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
}));

app.get('/api/employees', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`SELECT e.*, c.name AS contractor_name,
      count(d.id)::int AS document_count,
      count(d.id) FILTER (WHERE d.expires_on < CURRENT_DATE)::int AS expired_count,
      count(d.id) FILTER (WHERE d.expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 months')::int AS expiring_count
    FROM employees e LEFT JOIN contractors c ON c.id=e.contractor_id LEFT JOIN documents d ON d.employee_id=e.id
    WHERE ($1::text IS NULL OR e.status=$1) AND ($2::uuid IS NULL OR e.contractor_id=$2)
      AND ($3::text IS NULL OR e.full_name ILIKE '%'||$3||'%' OR c.name ILIKE '%'||$3||'%')
    GROUP BY e.id,c.name ORDER BY e.full_name`, [req.query.status || null, req.query.contractorId || null, req.query.search || null]);
  res.json(rows);
}));

app.get('/api/employees/:id', asyncRoute(async (req, res) => {
  const { rows: [row] } = await pool.query(`SELECT e.*, c.name AS contractor_name,
      count(d.id)::int AS document_count FROM employees e
    LEFT JOIN contractors c ON c.id=e.contractor_id LEFT JOIN documents d ON d.employee_id=e.id
    WHERE e.id=$1 GROUP BY e.id,c.name`, [req.params.id]);
  if (!row) return res.sendStatus(404);
  res.json(row);
}));

app.post('/api/employees', asyncRoute(async (req, res) => {
  const { contractorId, fullName, jobTitle = '', birthDate = null } = req.body;
  if (!contractorId || !fullName?.trim()) throw bad('Informe empreiteira e nome completo.');
  if (birthDate && !isISODate(birthDate)) throw bad('Data de nascimento inválida (use AAAA-MM-DD).');
  const row = await withTransaction(async (client) => {
    const { rows: [company] } = await client.query("SELECT id FROM contractors WHERE id=$1 AND status='active'", [contractorId]);
    if (!company) throw bad('Empreiteira não encontrada ou desligada.');
    const { rows: [employee] } = await client.query(`INSERT INTO employees(contractor_id,full_name,job_title,birth_date)
      VALUES($1,$2,$3,$4) RETURNING *`, [contractorId, fullName.trim(), jobTitle, birthDate]);
    await client.query('INSERT INTO employee_contractor_history(employee_id,contractor_id) VALUES($1,$2)', [employee.id, contractorId]);
    await audit(client, 'employee', employee.id, 'created', { contractorId }); return employee;
  });
  res.status(201).json(row);
}));

app.patch('/api/employees/:id/status', asyncRoute(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) throw bad('Status deve ser active ou inactive.');
  const result = await withTransaction(async (client) => {
    const { rows: [current] } = await client.query('SELECT * FROM employees WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!current) return null;
    if (status === 'active' && current.status !== 'active') {
      const { rows: [company] } = await client.query("SELECT id FROM contractors WHERE id=$1 AND status='active'", [current.contractor_id]);
      if (!company) throw bad('Reative a empreiteira antes de reativar o colaborador.');
      await client.query('INSERT INTO employee_contractor_history(employee_id,contractor_id) VALUES($1,$2)', [current.id, current.contractor_id]);
    }
    if (status === 'inactive' && current.status === 'active') {
      await client.query('UPDATE employee_contractor_history SET ended_on=CURRENT_DATE WHERE employee_id=$1 AND ended_on IS NULL', [current.id]);
    }
    const { rows: [row] } = await client.query('UPDATE employees SET status=$1,updated_at=now() WHERE id=$2 RETURNING *', [status, req.params.id]);
    await audit(client, 'employee', row.id, 'status_changed', { status }); return row;
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
}));

app.post('/api/employees/:id/transfer', asyncRoute(async (req, res) => {
  const { contractorId } = req.body;
  if (!contractorId) throw bad('Informe a empreiteira de destino.');
  const employee = await withTransaction(async (client) => {
    const { rows: [current] } = await client.query('SELECT * FROM employees WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!current) return null;
    if (current.status !== 'active') throw bad('Só é possível transferir colaborador ativo.');
    const { rows: [target] } = await client.query("SELECT id FROM contractors WHERE id=$1 AND status='active'", [contractorId]);
    if (!target) throw bad('Empreiteira de destino não encontrada ou desligada.');
    if (current.contractor_id === contractorId) throw bad('O colaborador já pertence a essa empreiteira.');
    await client.query('UPDATE employee_contractor_history SET ended_on=CURRENT_DATE WHERE employee_id=$1 AND ended_on IS NULL', [current.id]);
    await client.query('INSERT INTO employee_contractor_history(employee_id,contractor_id) VALUES($1,$2)', [current.id, contractorId]);
    const { rows: [updated] } = await client.query('UPDATE employees SET contractor_id=$1,updated_at=now() WHERE id=$2 RETURNING *', [contractorId, current.id]);
    await audit(client, 'employee', current.id, 'transferred', { from: current.contractor_id, to: contractorId }); return updated;
  });
  if (!employee) return res.sendStatus(404);
  res.json(employee);
}));

app.get('/api/employees/:id/history', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(`SELECT h.*, c.name AS contractor_name FROM employee_contractor_history h
    JOIN contractors c ON c.id=h.contractor_id WHERE h.employee_id=$1 ORDER BY h.started_on`, [req.params.id]);
  res.json(rows);
}));

app.get('/api/employees/:id/documents', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM documents WHERE employee_id=$1 ORDER BY expires_on', [req.params.id]);
  res.json(rows);
}));

app.post('/api/employees/:id/documents', asyncRoute(async (req, res) => {
  const { documentType, issueDate, expiresOn, driveFileName = null, driveUrl = null, isTraining = false } = req.body;
  if (!documentType?.trim() || !isISODate(issueDate)) throw bad('Informe tipo de documento e data de emissão válida.');
  if (expiresOn && !isISODate(expiresOn)) throw bad('Data de validade inválida (use AAAA-MM-DD).');
  const manualExpiry = Boolean(expiresOn);
  const expiry = expiresOn || addYears(issueDate, 2);
  if (expiry < issueDate) throw bad('A validade não pode ser anterior à emissão.');
  const row = await withTransaction(async (client) => {
    const { rows: [person] } = await client.query('SELECT id FROM employees WHERE id=$1', [req.params.id]);
    if (!person) return null;
    const { rows: [doc] } = await client.query(`INSERT INTO documents(employee_id,document_type,issue_date,expires_on,manual_expiry,drive_file_name,drive_url,is_training)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [person.id, documentType.trim(), issueDate, expiry, manualExpiry, driveFileName, driveUrl, Boolean(isTraining)]);
    await audit(client, 'document', doc.id, 'created', { employeeId: person.id }); return doc;
  });
  if (!row) return res.sendStatus(404);
  res.status(201).json(row);
}));

app.patch('/api/documents/:id/expiry', asyncRoute(async (req, res) => {
  const { expiresOn } = req.body;
  if (!isISODate(expiresOn)) throw bad('Informe uma data válida (AAAA-MM-DD).');
  const result = await withTransaction(async (client) => {
    const { rows: [doc] } = await client.query('UPDATE documents SET expires_on=$1,manual_expiry=true,updated_at=now() WHERE id=$2 AND issue_date <= $1 RETURNING *', [expiresOn, req.params.id]);
    if (doc) await audit(client, 'document', doc.id, 'expiry_changed', { expiresOn }); return doc;
  });
  if (!result) return res.status(404).json({ error: 'Documento não encontrado.' });
  res.json(result);
}));

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  const { rows: [summary] } = await pool.query(`SELECT
    (SELECT count(*)::int FROM contractors WHERE status='active') AS active_contractors,
    (SELECT count(*)::int FROM employees WHERE status='active') AS active_employees,
    (SELECT count(*)::int FROM documents d JOIN employees e ON e.id=d.employee_id JOIN contractors c ON c.id=e.contractor_id
      WHERE e.status='active' AND c.status='active' AND d.expires_on < CURRENT_DATE) AS expired_documents,
    (SELECT count(*)::int FROM documents d JOIN employees e ON e.id=d.employee_id JOIN contractors c ON c.id=e.contractor_id
      WHERE e.status='active' AND c.status='active' AND d.expires_on BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 months') AS expiring_documents`);
  const { rows: trainings } = await pool.query(`SELECT to_char(date_trunc('month',issue_date),'YYYY-MM') AS month,count(*)::int AS count
    FROM documents WHERE is_training AND issue_date >= date_trunc('year',CURRENT_DATE) GROUP BY 1 ORDER BY 1`);
  res.json({ ...summary, training_counts_by_month: trainings });
}));

app.get('/api/audit', asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM audit_log WHERE ($1::text IS NULL OR entity_type=$1) AND ($2::uuid IS NULL OR entity_id=$2) ORDER BY created_at DESC LIMIT 200', [req.query.entityType || null, req.query.entityId || null]);
  res.json(rows);
}));

app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === '23503' ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.expose ? err.message : status >= 500 ? 'Erro interno do servidor.' : err.message });
});

