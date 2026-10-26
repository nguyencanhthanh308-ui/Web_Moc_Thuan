const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SESSION_MS = 30 * 24 * 3600 * 1000;
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const hashPassword = pw => bcrypt.hash(pw, 10);
const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);
const normEmail = e => (typeof e === 'string' ? e.trim().toLowerCase() : '');
const publicUser = u => ({ id: u.id, email: u.email, role: u.role, name: u.name, phone: u.phone, address: u.address });

async function issueSession(db, userId, now = () => new Date()) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query('insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)',
    [sha256(token), userId, new Date(now().getTime() + SESSION_MS)]);
  return token;
}

function bearerToken(req) {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '');
  return m ? m[1] : null;
}

function attachUser(db, now = () => new Date()) {
  return async (req, res, next) => {
    req.user = null;
    const token = bearerToken(req);
    if (token) {
      const rows = await db.query(
        'select u.id, u.email, u.role, u.name, u.phone, u.address from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > $2',
        [sha256(token), now()]);
      if (rows[0]) req.user = publicUser(rows[0]);
    }
    next();
  };
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Bạn cần đăng nhập.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Bạn cần đăng nhập.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
  next();
}

module.exports = { sha256, hashPassword, checkPassword, normEmail, publicUser, issueSession, bearerToken, attachUser, requireUser, requireAdmin };
