const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { sha256, hashPassword, checkPassword, normEmail, publicUser, issueSession, bearerToken, requireUser } = require('../auth');
const { sendCapped } = require('../services/mailer');

const MIN_PW = 8;
const RESET_MS = 3600 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = v => (typeof v === 'string' ? v.trim() : '');
const bad = (res, msg) => res.status(400).json({ error: msg });

const limiter = (limit, windowMs, error, extra = {}) => rateLimit({
  windowMs, limit, standardHeaders: true, legacyHeaders: false, ...extra,
  handler: (req, res) => res.status(429).json({ error })
});

module.exports = function authRouter({ db, mailer, config, now }) {
  const r = express.Router();
  r.use((req, res, next) => { req.body = req.body || {}; next(); });
  const loginLimit = limiter(10, 15 * 60 * 1000, 'Bạn đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút.', { skipSuccessfulRequests: true });
  const forgotLimit = limiter(5, 3600 * 1000, 'Bạn yêu cầu quá nhiều lần, vui lòng thử lại sau 1 giờ.');

  r.post('/register', async (req, res) => {
    const email = normEmail(req.body.email);
    const name = str(req.body.name);
    const password = req.body.password;
    if (!EMAIL_RE.test(email)) return bad(res, 'Email không hợp lệ.');
    if (typeof password !== 'string' || password.length < MIN_PW) return bad(res, 'Mật khẩu cần có ít nhất 8 ký tự.');
    if (!name) return bad(res, 'Vui lòng nhập họ tên.');
    if ((await db.query('select 1 from users where email = $1', [email])).length) return res.status(409).json({ error: 'Email này đã được đăng ký.' });
    let user;
    try {
      [user] = await db.query(
        "insert into users (email, password_hash, role, name, phone, address) values ($1,$2,'customer',$3,$4,$5) returning id, email, role, name, phone, address",
        [email, await hashPassword(password), name, str(req.body.phone) || null, str(req.body.address) || null]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Email này đã được đăng ký.' });
      throw e;
    }
    res.status(201).json({ token: await issueSession(db, user.id, now), user: publicUser(user) });
  });

  r.post('/login', loginLimit, async (req, res) => {
    const email = normEmail(req.body.email);
    const password = req.body.password;
    if (!email || typeof password !== 'string' || !password) return bad(res, 'Vui lòng nhập email và mật khẩu.');
    const [u] = await db.query('select * from users where email = $1', [email]);
    if (!u || !(await checkPassword(password, u.password_hash))) return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    res.json({ token: await issueSession(db, u.id, now), user: publicUser(u) });
  });

  r.post('/logout', async (req, res) => {
    const token = bearerToken(req);
    if (token) await db.query('delete from sessions where token_hash = $1', [sha256(token)]);
    res.json({ ok: true });
  });

  r.get('/me', requireUser, (req, res) => res.json({ user: req.user }));

  r.put('/me', requireUser, async (req, res) => {
    const name = str(req.body.name);
    if (!name) return bad(res, 'Vui lòng nhập họ tên.');
    const [u] = await db.query(
      'update users set name = $1, phone = $2, address = $3 where id = $4 returning id, email, role, name, phone, address',
      [name, str(req.body.phone) || null, str(req.body.address) || null, req.user.id]);
    res.json({ user: publicUser(u) });
  });

  r.post('/forgot', forgotLimit, async (req, res) => {
    const email = normEmail(req.body.email);
    const [u] = email ? await db.query('select id, email from users where email = $1', [email]) : [];
    if (u) {
      try {
        const token = crypto.randomBytes(32).toString('base64url');
        await db.query('insert into password_resets (token_hash, user_id, expires_at) values ($1,$2,$3)',
          [sha256(token), u.id, new Date(now().getTime() + RESET_MS)]);
        const link = `${config.siteUrl}/#dat-lai-mat-khau=${token}`;
        await sendCapped(mailer, {
          to: u.email,
          subject: 'Đặt lại mật khẩu - Mộc Thuận',
          text: `Bạn vừa yêu cầu đặt lại mật khẩu. Mở liên kết sau (có hiệu lực trong 1 giờ): ${link}\nNếu không phải bạn, hãy bỏ qua email này.`,
          html: `<p>Bạn vừa yêu cầu đặt lại mật khẩu tại Mộc Thuận.</p><p><a href="${link}">Đặt lại mật khẩu</a> (liên kết có hiệu lực trong 1 giờ).</p><p>Nếu không phải bạn, hãy bỏ qua email này.</p>`
        }, config.mailTimeoutMs || 8000, 'đặt lại mật khẩu');
      } catch (e) {
        console.error('Không gửi được email đặt lại mật khẩu', e);
      }
    }
    res.json({ ok: true });
  });

  r.post('/reset', async (req, res) => {
    const { token, password } = req.body;
    if (typeof password !== 'string' || password.length < MIN_PW) return bad(res, 'Mật khẩu cần có ít nhất 8 ký tự.');
    if (typeof token !== 'string' || !token) return bad(res, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    const hash = await hashPassword(password);
    const ok = await db.tx(async t => {
      const [row] = await t.query('update password_resets set used = true where token_hash = $1 and used = false and expires_at > $2 returning user_id', [sha256(token), now()]);
      if (!row) return false;
      await t.query('update users set password_hash = $1 where id = $2', [hash, row.user_id]);
      await t.query('update password_resets set used = true where user_id = $1 and used = false', [row.user_id]);
      await t.query('delete from sessions where user_id = $1', [row.user_id]);
      return true;
    });
    if (!ok) return bad(res, 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    res.json({ ok: true });
  });

  return r;
};
