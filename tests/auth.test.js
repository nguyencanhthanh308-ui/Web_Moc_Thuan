const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { newTestApp } = require('./helpers');
const { requireAdmin, requireUser } = require('../server/auth');
const { createOrPromoteAdmin } = require('../server/scripts/create-admin');

const reg = (app, o = {}) => request(app).post('/api/auth/register').send({ email: 'khach@example.com', password: 'matkhau123', name: 'Khách', ...o });
const bearer = t => ({ Authorization: 'Bearer ' + t });
const resetToken = m => m.html.match(/#dat-lai-mat-khau=([\w-]+)/)[1];

test('đăng ký xong, token dùng được ở /me và không lộ password_hash', async () => {
  const { app } = await newTestApp();
  const r = await reg(app, { email: '  Khach@Example.com ', phone: '0900', address: 'HCM' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, 'khach@example.com');
  assert.equal(r.body.user.role, 'customer');
  assert.equal(r.body.user.password_hash, undefined);
  const me = await request(app).get('/api/auth/me').set(bearer(r.body.token));
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Khách');
  assert.equal(me.body.user.phone, '0900');
  assert.equal(me.body.user.password_hash, undefined);
});

test('đăng ký kèm role admin vẫn là customer', async () => {
  const { app } = await newTestApp();
  const r = await reg(app, { role: 'admin' });
  assert.equal(r.body.user.role, 'customer');
});

test('đăng ký: mật khẩu ngắn 400, thiếu tên 400, email sai 400, email trùng 409', async () => {
  const { app } = await newTestApp();
  assert.equal((await reg(app, { password: '1234567' })).status, 400);
  assert.equal((await reg(app, { name: '' })).status, 400);
  assert.equal((await reg(app, { email: 'khong-hop-le' })).status, 400);
  assert.equal((await reg(app)).status, 201);
  const dup = await reg(app, { email: 'KHACH@example.com' });
  assert.equal(dup.status, 409);
  assert.ok(dup.body.error);
});

test('đăng nhập đúng được, sai mật khẩu hoặc email lạ đều 401 cùng thông báo', async () => {
  const { app } = await newTestApp();
  await reg(app);
  const ok = await request(app).post('/api/auth/login').send({ email: 'Khach@example.com', password: 'matkhau123' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
  const bad = await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'sai-roi-nha' });
  const none = await request(app).post('/api/auth/login').send({ email: 'la@example.com', password: 'sai-roi-nha' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error, 'Email hoặc mật khẩu không đúng');
  assert.equal(none.status, 401);
  assert.equal(none.body.error, bad.body.error);
});

test('đăng nhập sai lần thứ 11 trong 15 phút thì 429, đăng nhập đúng không bị tính', async () => {
  const { app } = await newTestApp();
  await reg(app);
  for (let i = 0; i < 3; i++) assert.equal((await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'matkhau123' })).status, 200);
  for (let i = 0; i < 10; i++) assert.equal((await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'sai-roi-nha' })).status, 401);
  const r = await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'sai-roi-nha' });
  assert.equal(r.status, 429);
  assert.ok(r.body.error);
});

test('logout xong token cũ bị 401', async () => {
  const { app } = await newTestApp();
  const { body } = await reg(app);
  assert.equal((await request(app).post('/api/auth/logout').set(bearer(body.token))).status, 200);
  assert.equal((await request(app).get('/api/auth/me').set(bearer(body.token))).status, 401);
});

test('không có token hoặc token bậy thì /me 401', async () => {
  const { app } = await newTestApp();
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set(bearer('bay-ba'))).status, 401);
});

test('token hết hạn (now giả) thì 401', async () => {
  let t = new Date('2026-01-01T00:00:00Z');
  const { app } = await newTestApp({ now: () => t });
  const { body } = await reg(app);
  t = new Date('2026-01-30T00:00:00Z');
  assert.equal((await request(app).get('/api/auth/me').set(bearer(body.token))).status, 200);
  t = new Date('2026-02-01T00:00:01Z');
  assert.equal((await request(app).get('/api/auth/me').set(bearer(body.token))).status, 401);
});

test('PUT /me cập nhật hồ sơ', async () => {
  const { app } = await newTestApp();
  const { body } = await reg(app);
  const r = await request(app).put('/api/auth/me').set(bearer(body.token)).send({ name: 'Tên mới', phone: '0911', address: 'Hà Nội' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.name, 'Tên mới');
  const me = await request(app).get('/api/auth/me').set(bearer(body.token));
  assert.equal(me.body.user.address, 'Hà Nội');
  assert.equal((await request(app).put('/api/auth/me').send({ name: 'x' })).status, 401);
  assert.equal((await request(app).put('/api/auth/me').set(bearer(body.token)).send({ name: '' })).status, 400);
});

test('forgot với email lạ: 200 và không gửi thư', async () => {
  const { app, mailer } = await newTestApp();
  const r = await request(app).post('/api/auth/forgot').send({ email: 'la@example.com' });
  assert.equal(r.status, 200);
  assert.equal(mailer.sent.length, 0);
});

test('forgot gửi thư có liên kết đặt lại, lỗi gửi thư vẫn 200', async () => {
  const { app, mailer } = await newTestApp({ config: { siteUrl: 'https://shop.test' } });
  await reg(app);
  const r = await request(app).post('/api/auth/forgot').send({ email: ' KHACH@example.com' });
  assert.equal(r.status, 200);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'khach@example.com');
  assert.match(mailer.sent[0].html, /https:\/\/shop\.test\/#dat-lai-mat-khau=[\w-]+/);
  mailer.fail = true;
  const origErr = console.error;
  console.error = () => {};
  try { assert.equal((await request(app).post('/api/auth/forgot').send({ email: 'khach@example.com' })).status, 200); } finally { console.error = origErr; }
});

test('forgot giới hạn 5 lần / giờ / IP', async () => {
  const { app } = await newTestApp();
  for (let i = 0; i < 5; i++) assert.equal((await request(app).post('/api/auth/forgot').send({ email: 'la@example.com' })).status, 200);
  assert.equal((await request(app).post('/api/auth/forgot').send({ email: 'la@example.com' })).status, 429);
});

test('reset: mật khẩu mới đăng nhập được, token cũ 401, dùng lại reset token 400', async () => {
  const { app, mailer, db } = await newTestApp({ config: { siteUrl: 'https://shop.test' } });
  const { body } = await reg(app);
  await request(app).post('/api/auth/forgot').send({ email: 'khach@example.com' });
  const rt = resetToken(mailer.sent[0]);
  const stored = await db.query('select token_hash from password_resets');
  assert.equal(stored[0].token_hash, crypto.createHash('sha256').update(rt).digest('hex'));
  assert.equal((await request(app).post('/api/auth/reset').send({ token: rt, password: 'ngan' })).status, 400);
  const r = await request(app).post('/api/auth/reset').send({ token: rt, password: 'matkhaumoi1' });
  assert.equal(r.status, 200);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'matkhaumoi1' })).status, 200);
  assert.equal((await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'matkhau123' })).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set(bearer(body.token))).status, 401);
  assert.equal((await request(app).post('/api/auth/reset').send({ token: rt, password: 'matkhaumoi2' })).status, 400);
  assert.equal((await request(app).post('/api/auth/reset').send({ token: 'khong-co', password: 'matkhaumoi2' })).status, 400);
});

test('reset token quá 1 giờ thì 400', async () => {
  let t = new Date('2026-01-01T00:00:00Z');
  const { app, mailer } = await newTestApp({ now: () => t });
  await reg(app);
  await request(app).post('/api/auth/forgot').send({ email: 'khach@example.com' });
  const rt = resetToken(mailer.sent[0]);
  t = new Date('2026-01-01T01:00:01Z');
  assert.equal((await request(app).post('/api/auth/reset').send({ token: rt, password: 'matkhaumoi1' })).status, 400);
});

function runMw(mw, user) {
  const out = {};
  const res = { status(c) { out.status = c; return this; }, json(b) { out.body = b; return this; } };
  mw({ user }, res, () => { out.next = true; });
  return out;
}

test('requireAdmin: khách 403, chưa đăng nhập 401, admin qua; requireUser 401', () => {
  assert.equal(runMw(requireAdmin, { id: 1, role: 'customer' }).status, 403);
  assert.equal(runMw(requireAdmin, null).status, 401);
  assert.equal(runMw(requireAdmin, { id: 1, role: 'admin' }).next, true);
  assert.equal(runMw(requireUser, null).status, 401);
  assert.equal(runMw(requireUser, { id: 1, role: 'customer' }).next, true);
});

test('createOrPromoteAdmin: tạo mới, rồi nâng vai trò và đổi mật khẩu', async () => {
  const { app, db } = await newTestApp();
  assert.equal(await createOrPromoteAdmin(db, ' Chu@Shop.com ', 'matkhau123'), 'created');
  const login = await request(app).post('/api/auth/login').send({ email: 'chu@shop.com', password: 'matkhau123' });
  assert.equal(login.body.user.role, 'admin');
  await reg(app);
  assert.equal(await createOrPromoteAdmin(db, 'khach@example.com', 'matkhaumoi1'), 'promoted');
  const l2 = await request(app).post('/api/auth/login').send({ email: 'khach@example.com', password: 'matkhaumoi1' });
  assert.equal(l2.body.user.role, 'admin');
  await assert.rejects(createOrPromoteAdmin(db, 'x@y.com', 'ngan'), /8 ký tự/);
});
