import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool, withTransaction } from './db.js';

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const COOKIE_NAME = 'gestao_sst_session';
const attempts = new Map();

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const cookieOptions = () => `Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, hashHex] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function readCookie(req) {
  const raw = req.headers.cookie || '';
  const value = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`));
  return value ? decodeURIComponent(value.slice(COOKIE_NAME.length + 1)) : '';
}

function checkSameOrigin(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
    return res.status(403).json({ error: 'Origem da requisição não permitida.' });
  }
  next();
}

export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador';
  if (process.env.NODE_ENV === 'production' && (!email || !password || password.length < 12)) {
    throw new Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 12 caracteres) nos segredos antes de iniciar em produção.');
  }
  if (!email || !password) return;
  const existing = await pool.query('SELECT id FROM app_users WHERE lower(email)=$1 LIMIT 1', [email]);
  if (existing.rowCount) return;
  const passwordHash = await hashPassword(password);
  await pool.query('INSERT INTO app_users(email,full_name,password_hash) VALUES($1,$2,$3)', [email, name, passwordHash]);
  console.log(`Usuário inicial criado: ${email}`);
}

export function registerAuthRoutes(app, asyncRoute, bad) {
  app.post('/api/auth/login', checkSameOrigin, asyncRoute(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (password.length > 128) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    const ip = req.ip;
    const recent = attempts.get(ip) || [];
    const active = recent.filter((time) => Date.now() - time < 15 * 60 * 1000);
    if (active.length >= 10) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' });
    const { rows: [user] } = await pool.query('SELECT * FROM app_users WHERE lower(email)=$1 AND active=true', [email]);
    const valid = user && await verifyPassword(password, user.password_hash);
    if (!valid) {
      attempts.set(ip, [...active, Date.now()]);
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }
    attempts.delete(ip);
    const token = randomBytes(32).toString('base64url');
    await pool.query('DELETE FROM app_sessions WHERE expires_at < now()');
    await pool.query('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [hashToken(token), user.id, new Date(Date.now() + SESSION_TTL_MS)]);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions()}`);
    res.json({ user: { id: user.id, email: user.email, fullName: user.full_name } });
  }));

  app.post('/api/auth/logout', checkSameOrigin, asyncRoute(async (req, res) => {
    const token = readCookie(req);
    if (token) await pool.query('DELETE FROM app_sessions WHERE token_hash=$1', [hashToken(token)]);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.sendStatus(204);
  }));

  app.use('/api', checkSameOrigin, asyncRoute(async (req, res, next) => {
    if (req.path === '/health' || req.path === '/auth/login' || req.path === '/auth/logout') return next();
    const token = readCookie(req);
    if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });
    const { rows: [user] } = await pool.query(`SELECT u.id,u.email,u.full_name FROM app_sessions s
      JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`, [hashToken(token)]);
    if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    req.user = user;
    next();
  }));

  app.get('/api/auth/me', (req, res) => {
    res.json({ user: { id: req.user.id, email: req.user.email, fullName: req.user.full_name } });
  });

  app.patch('/api/auth/password', asyncRoute(async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 12 || newPassword.length > 128) throw bad('A nova senha deve ter entre 12 e 128 caracteres.');
    const { rows: [user] } = await pool.query('SELECT password_hash FROM app_users WHERE id=$1 AND active=true', [req.user.id]);
    if (!user || !await verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'A senha atual está incorreta.' });
    }
    const passwordHash = await hashPassword(newPassword);
    const token = randomBytes(32).toString('base64url');
    await withTransaction(async (client) => {
      await client.query('UPDATE app_users SET password_hash=$1 WHERE id=$2', [passwordHash, req.user.id]);
      await client.query('DELETE FROM app_sessions WHERE user_id=$1', [req.user.id]);
      await client.query('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [hashToken(token), req.user.id, new Date(Date.now() + SESSION_TTL_MS)]);
    });
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieOptions()}`);
    res.json({ ok: true });
  }));

  app.post('/api/auth/users', asyncRoute(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const fullName = String(req.body.fullName || '').trim();
    const password = String(req.body.password || '');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Informe um e-mail válido.');
    if (!fullName) throw bad('Informe o nome da pessoa.');
    if (password.length < 12 || password.length > 128) throw bad('A senha deve ter entre 12 e 128 caracteres.');
    const passwordHash = await hashPassword(password);
    try {
      const { rows: [user] } = await pool.query('INSERT INTO app_users(email,full_name,password_hash) VALUES($1,$2,$3) RETURNING id,email,full_name', [email, fullName, passwordHash]);
      res.status(201).json({ id: user.id, email: user.email, fullName: user.full_name });
    } catch (error) {
      if (error.code === '23505') throw bad('Já existe um usuário com esse e-mail.');
      throw error;
    }
  }));
}

