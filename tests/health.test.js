const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { newTestApp } = require('./helpers');
const { loadConfig } = require('../server/config');
const { FakeStorage, FakeMailer } = require('./helpers');

const FULL_ENV = Object.fromEntries(['DATABASE_URL', 'SITE_URL', 'API_PUBLIC_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SHOP_EMAIL'].map(k => [k, 'x']));

test('GET /api/health trả ok và có chạy truy vấn DB', async () => {
  const { app, db } = await newTestApp();
  let queried = 0;
  const orig = db.query;
  db.query = (...a) => { queried++; return orig(...a); };
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.ok(queried >= 1);
});

test('CORS: origin lạ không có header cho phép', async () => {
  const { app } = await newTestApp({ config: { corsOrigins: ['https://shop.example'] } });
  const res = await request(app).options('/api/health').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('CORS: origin trong corsOrigins được phép', async () => {
  const { app } = await newTestApp({ config: { corsOrigins: ['https://shop.example'] } });
  const res = await request(app).options('/api/health').set('Origin', 'https://shop.example').set('Access-Control-Request-Method', 'GET');
  assert.equal(res.headers['access-control-allow-origin'], 'https://shop.example');
});

test('CORS: dev không đặt CORS_ORIGINS thì cho localhost mọi cổng, không cho origin lạ', async () => {
  const config = loadConfig({ NODE_ENV: 'development', ...FULL_ENV });
  assert.deepEqual(config.corsOrigins, []);
  const { app } = await newTestApp({ config });
  const ok = await request(app).options('/api/health').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET');
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173');
  const ok2 = await request(app).options('/api/health').set('Origin', 'http://127.0.0.1:8080').set('Access-Control-Request-Method', 'GET');
  assert.equal(ok2.headers['access-control-allow-origin'], 'http://127.0.0.1:8080');
  const bad = await request(app).options('/api/health').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'GET');
  assert.equal(bad.headers['access-control-allow-origin'], undefined);
});

test('CORS: production không đặt CORS_ORIGINS thì không cho localhost', async () => {
  const { app } = await newTestApp({ config: { nodeEnv: 'production', corsOrigins: [] } });
  const res = await request(app).options('/api/health').set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'GET');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('/api/* không có thì 404 JSON tiếng Việt', async () => {
  const { app } = await newTestApp();
  const res = await request(app).get('/api/khong-co');
  assert.equal(res.status, 404);
  assert.match(res.body.error, /Không tìm thấy/);
});

test('JSON hỏng trả 400, lỗi lạ trả 500 chung chung không lộ stack', async () => {
  const { app } = await newTestApp();
  const bad = await request(app).post('/api/health').set('Content-Type', 'application/json').send('{x');
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /không hợp lệ/);
  const { db } = await newTestApp();
  db.query = async () => { throw new Error('secret stack detail'); };
  const { createApp } = require('../server/app');
  const app2 = createApp({ db, storage: new FakeStorage(), mailer: new FakeMailer(), config: loadConfig({ NODE_ENV: 'test' }) });
  const origErr = console.error;
  console.error = () => {};
  let res;
  try { res = await request(app2).get('/api/health'); } finally { console.error = origErr; }
  assert.equal(res.status, 500);
  assert.ok(!JSON.stringify(res.body).includes('secret'));
  assert.match(res.body.error, /Có lỗi/);
});

test('loadConfig ném lỗi tiếng Việt nêu biến thiếu ngoài môi trường test', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /DATABASE_URL/);
  const c = loadConfig({ NODE_ENV: 'test' });
  assert.equal(c.port, 3000);
});

test('FakeStorage và FakeMailer', async () => {
  const s = new FakeStorage();
  assert.equal(await s.put('a/b.jpg', Buffer.from('x'), 'image/jpeg'), 'https://fake.storage/a/b.jpg');
  assert.ok(s.files.has('a/b.jpg'));
  const m = new FakeMailer();
  await m.send({ to: 'a@b.c', subject: 's', html: 'h', text: 't' });
  assert.equal(m.sent.length, 1);
  m.fail = true;
  await assert.rejects(m.send({ to: 'x' }));
});
