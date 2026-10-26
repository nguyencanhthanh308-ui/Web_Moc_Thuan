const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { newTestApp, tokenFor } = require('./helpers');
const { nextOrderCode, normalizePhone, STATUSES } = require('../server/services/orders');
const { esc } = require('../server/services/mailer');
const { createDb } = require('../server/db');

const bearer = t => ({ Authorization: 'Bearer ' + t });
const rowOf = (id, o = {}) => ({ id, code: 'MA' + id, sub: 'ban-giam-doc', kind: 'desk_exec', style: 'có hộc', name: 'Bàn ' + id,
  prices: [[160, 4810000], [180, 5170000]], W: 160, wood: 'caosu', frame: 'den', uph: 'den', sale: 0, ...o });

async function setup(overrides = {}) {
  const t = await newTestApp({ ...overrides, config: { shopEmail: 'shop@example.com', siteUrl: 'https://moc.example', orderRateLimit: 1000, ...overrides.config } });
  for (const [id, hidden, o] of [[1, false, {}], [2, true, {}], [3, false, { kind: 'chairOffice', prices: [[62, 1850000]], W: 62 }]]) {
    await t.db.query('insert into products (id, code, data, hidden, updated_at) values ($1,$2,$3,$4,now())',
      [id, 'MA' + id, JSON.stringify(rowOf(id, o)), hidden]);
  }
  return t;
}

const body = (o = {}) => ({
  customer: { name: 'Nguyễn An', phone: '0386 115 316', address: '12 Lê Lợi, Q1' },
  payment: 'khi-nhan', note: 'Gọi trước khi giao',
  items: [{ id: 1, W: 160, wood: 'caosu', frame: 'den', qty: 2 }],
  ...o
});
const quiet = async fn => {
  const orig = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
};

test('đơn hợp lệ: 201, lưu đơn moi + event tao, gửi 1 thư tới shopEmail', async () => {
  const { app, db, mailer } = await setup();
  const r = await request(app).post('/api/orders').send(body());
  assert.equal(r.status, 201);
  assert.match(r.body.code, /^DH\d{6}-001$/);
  const [o] = await db.query('select * from orders');
  assert.equal(o.code, r.body.code);
  assert.equal(o.status, 'moi');
  assert.equal(o.user_id, null);
  assert.equal(Number(o.total), 9620000);
  assert.equal(o.customer.phone, '0386115316');
  const l = o.lines[0];
  assert.deepEqual([l.productId, l.name, l.W, l.D, l.H, l.wood, l.woodName, l.frame, l.uph, l.qty, l.unitPrice, l.custom, l.estimate],
    [1, 'Bàn 1', 160, 80, 76, 'caosu', 'Gỗ cao su', 'den', null, 2, 4810000, false, false]);
  const ev = await db.query('select kind from order_events where order_id = $1', [o.id]);
  assert.deepEqual(ev.map(e => e.kind), ['tao']);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'shop@example.com');
  assert.match(mailer.sent[0].subject, /^\[Mộc Thuận\] Đơn mới DH\d{6}-001 – Nguyễn An – 9\.620\.000 ₫$/);
  assert.ok(mailer.sent[0].html.includes('https://moc.example/admin.html#don=' + r.body.code));
});

test('đơn của người đã đăng nhập gắn user_id', async () => {
  const { app, db } = await setup();
  const token = await tokenFor(db, 'customer');
  const r = await request(app).post('/api/orders').set(bearer(token)).send(body());
  assert.equal(r.status, 201);
  const [o] = await db.query('select user_id from orders');
  assert.ok(o.user_id > 0);
});

test('giá client gửi bị bỏ qua, tổng tính lại từ DB (kể cả hệ số chất liệu)', async () => {
  const { app, db } = await setup();
  await db.query("insert into settings (key, value) values ('woodK', $1)", [JSON.stringify({ soi: 1.2 })]);
  const r = await request(app).post('/api/orders').send(body({
    items: [{ id: 1, W: 160, wood: 'soi', frame: 'den', qty: 1, unitPrice: 1, total: 1 }], total: 1 }));
  assert.equal(r.status, 201);
  const [o] = await db.query('select total, lines from orders');
  assert.equal(Number(o.total), 5770000);
  assert.equal(o.lines[0].unitPrice, 5770000);
});

test('kích thước riêng hợp lệ: tính giá, đánh dấu tạm tính; ngoài khoảng hoặc không chia hết cho 5 -> 400', async () => {
  const { app, db, mailer } = await setup();
  const ok = await request(app).post('/api/orders').send(body({ items: [{ id: 1, W: 170, wood: 'caosu', frame: 'den', qty: 1 }] }));
  assert.equal(ok.status, 201);
  const [o] = await db.query('select lines from orders');
  assert.equal(o.lines[0].unitPrice, 4990000);
  assert.deepEqual([o.lines[0].custom, o.lines[0].estimate], [true, true]);
  assert.ok(mailer.sent[0].html.includes('giá tạm tính'));
  for (const W of [300, 50, 163]) {
    const r = await request(app).post('/api/orders').send(body({ items: [{ id: 1, W, wood: 'caosu', frame: 'den', qty: 1 }] }));
    assert.equal(r.status, 400, 'W=' + W);
  }
  assert.equal((await db.query('select id from orders')).length, 1);
});

test('sản phẩm ẩn hoặc không có -> 422 kèm unavailable, không lưu', async () => {
  const { app, db } = await setup();
  const r = await request(app).post('/api/orders').send(body({
    items: [{ id: 1, W: 160, wood: 'caosu', frame: 'den', qty: 1 }, { id: 2, W: 160, wood: 'caosu', frame: 'den', qty: 1 }, { id: 99, qty: 1 }] }));
  assert.equal(r.status, 422);
  assert.deepEqual(r.body.unavailable, [2, 99]);
  assert.ok(r.body.error);
  assert.equal((await db.query('select id from orders')).length, 0);
});

test('số điện thoại: 0123 -> 400, +84 386 115 316 -> lưu 0386115316', async () => {
  const { app, db } = await setup();
  const bad = await request(app).post('/api/orders').send(body({ customer: { name: 'A', phone: '0123', address: 'x' } }));
  assert.equal(bad.status, 400);
  const ok = await request(app).post('/api/orders').send(body({ customer: { name: 'A', phone: '+84 386 115 316', address: 'x' } }));
  assert.equal(ok.status, 201);
  assert.equal((await db.query('select customer from orders'))[0].customer.phone, '0386115316');
  assert.equal(normalizePhone('0386.115-316'), '0386115316');
  assert.equal(normalizePhone('0286115316'), null);
});

test('thiếu tên/địa chỉ, sai cách thanh toán, giỏ rỗng hoặc quá 30 món -> 400', async () => {
  const { app } = await setup();
  const item = { id: 1, W: 160, wood: 'caosu', frame: 'den', qty: 1 };
  const c = { name: 'A', phone: '0386115316', address: 'x' };
  const cases = [
    { customer: { ...c, name: ' ' } }, { customer: { ...c, address: '' } }, { payment: 'the' },
    { items: [] }, { items: 'x' }, { items: Array(31).fill(item) }
  ];
  for (const o of cases) assert.equal((await request(app).post('/api/orders').send(body(o))).status, 400, JSON.stringify(o).slice(0, 40));
});

test('số lượng 0 hoặc 51, chất liệu lạ -> 400; phần không dùng được lưu null', async () => {
  const { app, db } = await setup();
  const it = o => body({ items: [{ id: 1, W: 160, wood: 'caosu', frame: 'den', qty: 1, ...o }] });
  for (const o of [{ qty: 0 }, { qty: 51 }, { qty: 1.5 }, { wood: 'vang' }, { frame: 'do' }, { wood: undefined }]) {
    assert.equal((await request(app).post('/api/orders').send(it(o))).status, 400, JSON.stringify(o));
  }
  // ghế văn phòng (parts 'fu'): không cần wood, bỏ qua wood gửi lên
  const chair = await request(app).post('/api/orders').send(body({ items: [{ id: 3, W: 62, wood: 'bay-ba', frame: 'den', uph: 'be', qty: 1 }] }));
  assert.equal(chair.status, 201);
  const l = (await db.query('select lines from orders'))[0].lines[0];
  assert.deepEqual([l.wood, l.woodName, l.uph, l.uphName], [null, null, 'be', 'Vải be']);
});

test('ô bẫy website có giá trị -> 200 giả, không lưu, không gửi thư', async () => {
  const { app, db, mailer } = await setup();
  const r = await request(app).post('/api/orders').send(body({ website: 'http://spam' }));
  assert.equal(r.status, 200);
  assert.ok(r.body.code);
  assert.equal((await db.query('select id from orders')).length, 0);
  assert.equal(mailer.sent.length, 0);
});

test('đơn thứ 6 trong 10 phút -> 429 nhắc số điện thoại', async () => {
  const { app } = await setup({ config: { orderRateLimit: 5 } });
  for (let i = 0; i < 5; i++) assert.equal((await request(app).post('/api/orders').send(body())).status, 201);
  const r = await request(app).post('/api/orders').send(body());
  assert.equal(r.status, 429);
  assert.match(r.body.error, /0386 115 316/);
});

test('mailer lỗi -> vẫn 201, đơn vẫn có, có ghi log', async () => {
  const { app, db, mailer } = await setup();
  mailer.fail = true;
  const logs = [];
  const r = await quiet(async () => {
    const orig = console.error;
    console.error = (...a) => logs.push(a);
    try { return await request(app).post('/api/orders').send(body()); } finally { console.error = orig; }
  });
  assert.equal(r.status, 201);
  assert.equal((await db.query('select id from orders')).length, 1);
  assert.equal(logs.length, 1);
});

test('không có shopEmail -> bỏ qua việc gửi thư, vẫn 201', async () => {
  const { app, mailer } = await setup({ config: { shopEmail: '' } });
  assert.equal((await request(app).post('/api/orders').send(body())).status, 201);
  assert.equal(mailer.sent.length, 0);
});

test('tên khách <script> được escape trong html email', async () => {
  const { app, mailer } = await setup();
  const r = await request(app).post('/api/orders').send(body({ customer: { name: '<script>alert(1)</script>', phone: '0386115316', address: 'a "b" & \'c\'' } }));
  assert.equal(r.status, 201);
  const { html } = mailer.sent[0];
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&quot;b&quot; &amp; &#39;c&#39;'));
  assert.equal(esc(5), '5');
});

test('khách A không xem được đơn của khách B; danh sách chỉ có đơn của mình, không lộ ghi chú nội bộ', async () => {
  const { app, db } = await setup();
  const a = await tokenFor(db, 'customer', 'a@example.com');
  const b = await tokenFor(db, 'customer', 'b@example.com');
  const codeA = (await request(app).post('/api/orders').set(bearer(a)).send(body())).body.code;
  const codeB = (await request(app).post('/api/orders').set(bearer(b)).send(body())).body.code;
  await db.query("update orders set internal_note = 'bí mật' where code = $1", [codeA]);
  assert.equal((await request(app).get('/api/me/orders/' + codeB).set(bearer(a))).status, 404);
  assert.equal((await request(app).get('/api/me/orders')).status, 401);
  const list = await request(app).get('/api/me/orders').set(bearer(a));
  assert.deepEqual(list.body.orders.map(o => o.code), [codeA]);
  const o = list.body.orders[0];
  assert.deepEqual(Object.keys(o).sort(), ['code', 'created_at', 'customer', 'lines', 'note', 'payment', 'status', 'statusLabel', 'total', 'updated_at']);
  assert.equal(o.statusLabel, 'Mới');
  assert.equal(o.total, 9620000);
  const one = await request(app).get('/api/me/orders/' + codeA).set(bearer(a));
  assert.equal(one.status, 200);
  assert.ok(!JSON.stringify(one.body).includes('bí mật'));
});

test('mã đơn: số thứ tự theo ngày giờ Việt Nam, sang ngày mới bắt đầu lại từ -001', async () => {
  let cur = new Date('2026-10-26T03:00:00Z');
  const { app } = await setup({ now: () => cur });
  const codes = [];
  for (const t of ['2026-10-26T03:00:00Z', '2026-10-26T16:59:00Z', '2026-10-26T17:01:00Z']) {
    cur = new Date(t);
    codes.push((await request(app).post('/api/orders').send(body())).body.code);
  }
  assert.deepEqual(codes, ['DH261026-001', 'DH261026-002', 'DH261027-001']);
});

test('nextOrderCode đọc số lớn nhất trong ngày; STATUSES đủ 6 trạng thái', async () => {
  const { db } = await setup();
  assert.equal(await nextOrderCode(db, new Date('2026-10-26T03:00:00Z')), 'DH261026-001');
  await db.query(`insert into orders (code, status, customer, payment, lines, total) values ('DH261026-009','moi','{}','khi-nhan','[]',0)`);
  assert.equal(await nextOrderCode(db, new Date('2026-10-26T03:00:00Z')), 'DH261026-010');
  assert.deepEqual(Object.keys(STATUSES), ['moi', 'da-xac-nhan', 'dang-lam', 'da-giao', 'hoan-tat', 'da-huy']);
});

// pg-mem không thực sự hoàn tác khi rollback, nên kiểm tra bằng pool giả: db.tx phải gửi begin, rồi rollback (không commit) khi fn ném lỗi, và trả client về pool
function fakePool() {
  const log = [];
  const client = { query: async sql => { log.push(sql); return { rows: [] }; }, release: () => log.push('release') };
  return { log, pool: { connect: async () => client } };
}

test('db.tx: fn ném lỗi thì rollback, không commit, giữ lỗi gốc và trả client về pool', async () => {
  const { log, pool } = fakePool();
  const db = createDb(pool);
  await assert.rejects(db.tx(async tx => {
    await tx.query('insert into orders values (1)');
    throw new Error('hỏng giữa chừng');
  }), /hỏng giữa chừng/);
  assert.deepEqual(log, ['begin', 'insert into orders values (1)', 'rollback', 'release']);
});

test('db.tx: fn chạy xong thì commit', async () => {
  const { log, pool } = fakePool();
  assert.equal(await createDb(pool).tx(async () => 42), 42);
  assert.deepEqual(log, ['begin', 'commit', 'release']);
});

test('cùng requestId gửi lại (lần lượt hoặc cùng lúc) -> cùng mã, chỉ 1 đơn, 1 thư', async () => {
  const { app, db, mailer } = await setup();
  const rid = 'a1b2c3d4-e5f6-4711-8899-aabbccddeeff';
  const r1 = await request(app).post('/api/orders').send(body({ requestId: rid }));
  const r2 = await request(app).post('/api/orders').send(body({ requestId: rid }));
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);
  assert.equal(r2.body.code, r1.body.code);
  const rid2 = 'ffffeeee-dddd-4ccc-bbbb-aaaa99998888';
  const [c1, c2] = await Promise.all([1, 2].map(() => request(app).post('/api/orders').send(body({ requestId: rid2 }))));
  assert.equal(c1.status, 201);
  assert.equal(c2.status, 201);
  assert.equal(c1.body.code, c2.body.code);
  assert.notEqual(c1.body.code, r1.body.code);
  const rows = await db.query('select code, request_id from orders order by id');
  assert.deepEqual(rows.map(o => o.request_id), [rid, rid2]);
  assert.equal(mailer.sent.length, 2);
  const noId = await request(app).post('/api/orders').send(body());
  assert.equal(noId.status, 201);
  assert.equal((await db.query('select 1 from orders')).length, 3);
});

test('requestId sai dạng -> 400, không lưu', async () => {
  const { app, db } = await setup();
  for (const requestId of ['ngan', 'có dấu cách 12345', 'x'.repeat(65), 12345678, { a: 1 }]) {
    const r = await request(app).post('/api/orders').send(body({ requestId }));
    assert.equal(r.status, 400, JSON.stringify(requestId));
    assert.ok(r.body.error);
  }
  assert.equal((await db.query('select 1 from orders')).length, 0);
});
