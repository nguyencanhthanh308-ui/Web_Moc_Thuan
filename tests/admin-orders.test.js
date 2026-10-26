const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { newTestApp, tokenFor } = require('./helpers');

const bearer = t => ({ Authorization: 'Bearer ' + t });
const rowOf = id => ({ id, code: 'MA' + id, sub: 'ban-giam-doc', kind: 'desk_exec', style: 'có hộc', name: 'Bàn ' + id,
  prices: [[160, 4810000], [180, 5170000]], W: 160, wood: 'caosu', frame: 'den', uph: 'den', sale: 0 });

async function setup() {
  const t = await newTestApp({ config: { orderRateLimit: 1000 } });
  await t.db.query('insert into products (id, code, data, hidden, updated_at) values (1,$1,$2,false,now())', ['MA1', JSON.stringify(rowOf(1))]);
  t.admin = await tokenFor(t.db, 'admin');
  return t;
}

const item = (W, qty = 1) => ({ id: 1, W, wood: 'caosu', frame: 'den', qty });
const body = (o = {}) => ({
  customer: { name: 'Nguyễn An', phone: '0386 115 316', address: '12 Lê Lợi, Q1' },
  payment: 'khi-nhan', items: [item(160, 2)], ...o
});
const place = async (app, o, token) => {
  const r = request(app).post('/api/orders');
  return (await (token ? r.set(bearer(token)) : r).send(body(o))).body.code;
};
const put = (t, code, b, path = '') => request(t.app).put('/api/admin/orders/' + code + path).set(bearer(t.admin)).send(b);
const events = (db, code) => db.query('select e.* from order_events e join orders o on o.id = e.order_id where o.code = $1 order by e.id', [code]);

test('khách gọi API quản trị đơn -> 403; chưa đăng nhập -> 401', async () => {
  const t = await setup();
  const code = await place(t.app, {});
  const cust = await tokenFor(t.db, 'customer');
  for (const [m, p] of [['get', '/api/admin/orders'], ['get', '/api/admin/orders/' + code], ['put', '/api/admin/orders/' + code], ['put', '/api/admin/orders/' + code + '/status']]) {
    assert.equal((await request(t.app)[m](p).set(bearer(cust)).send({})).status, 403, m + p);
    assert.equal((await request(t.app)[m](p).send({})).status, 401, m + p);
  }
});

test('danh sách: counts đủ mọi đơn, lọc theo trạng thái, mới nhất trước, total là số đơn sau lọc', async () => {
  const t = await setup();
  const a = await place(t.app, {});
  const b = await place(t.app, {});
  const c = await place(t.app, {});
  await put(t, b, { status: 'da-huy' }, '/status');
  const all = await request(t.app).get('/api/admin/orders').set(bearer(t.admin));
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.orders.map(o => o.code), [c, b, a]);
  assert.equal(all.body.total, 3);
  assert.deepEqual(all.body.counts, { moi: 2, 'da-huy': 1 });
  assert.equal(all.body.orders[0].statusLabel, 'Mới');
  assert.equal(typeof all.body.orders[0].total, 'number');
  const f = await request(t.app).get('/api/admin/orders?status=moi').set(bearer(t.admin));
  assert.deepEqual(f.body.orders.map(o => o.code), [c, a]);
  assert.equal(f.body.total, 2);
  assert.deepEqual(f.body.counts, { moi: 2, 'da-huy': 1 });
  assert.equal((await request(t.app).get('/api/admin/orders?status=xyz').set(bearer(t.admin))).status, 400);
});

test('danh sách: tìm theo mã, tên (không phân biệt hoa thường), số điện thoại; phân trang 30 đơn', async () => {
  const t = await setup();
  const a = await place(t.app, { customer: { name: 'Trần Bình', phone: '0912345678', address: 'x' } });
  await place(t.app, {});
  const get = q => request(t.app).get('/api/admin/orders?' + q).set(bearer(t.admin));
  assert.deepEqual((await get('q=' + encodeURIComponent(a.toLowerCase()))).body.orders.map(o => o.code), [a]);
  assert.deepEqual((await get('q=' + encodeURIComponent('TRẦN bình'))).body.orders.map(o => o.code), [a]);
  assert.deepEqual((await get('q=0912.345')).body.orders.map(o => o.code), [a]);
  const none = await get('q=khongco');
  assert.equal(none.body.total, 0);
  assert.equal(none.body.counts.moi, 2);
  // 32 đơn nữa chèn thẳng: trang 1 có 30, trang 2 có phần còn lại
  for (let i = 0; i < 32; i++) {
    await t.db.query(`insert into orders (code, status, customer, payment, lines, total) values ($1,'moi','{"name":"K","phone":"0386115316"}','khi-nhan','[]',0)`, ['DH000000-' + String(i).padStart(3, '0')]);
  }
  const p1 = await get('page=1');
  const p2 = await get('page=2');
  assert.equal(p1.body.orders.length, 30);
  assert.equal(p2.body.orders.length, 4);
  assert.equal(p2.body.total, 34);
  assert.equal((await get('page=0')).body.orders.length, 30);
});

test('xem một đơn: đủ internal_note + events (cũ trước) kèm email người làm, đơn khách có email null', async () => {
  const t = await setup();
  const code = await place(t.app, {});
  await put(t, code, { internal_note: 'khách khó tính' });
  await put(t, code, { status: 'da-xac-nhan' }, '/status');
  const r = await request(t.app).get('/api/admin/orders/' + code).set(bearer(t.admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.order.internal_note, 'khách khó tính');
  assert.equal(r.body.order.statusLabel, 'Đã xác nhận');
  assert.deepEqual(r.body.order.events.map(e => [e.kind, e.actor_email]), [['tao', null], ['sua', 'admin@example.com'], ['trang-thai', 'admin@example.com']]);
  assert.equal((await request(t.app).get('/api/admin/orders/DH000000-999').set(bearer(t.admin))).status, 404);
});

test('đổi trạng thái: event trang-thai đúng; cùng trạng thái -> 200, không thêm event; sai -> 400; không có đơn -> 404', async () => {
  const t = await setup();
  const code = await place(t.app, {});
  const r = await put(t, code, { status: 'dang-lam' }, '/status');
  assert.equal(r.status, 200);
  assert.equal(r.body.order.status, 'dang-lam');
  const ev = await events(t.db, code);
  assert.deepEqual(ev.map(e => e.kind), ['tao', 'trang-thai']);
  assert.deepEqual([ev[1].before, ev[1].after], [{ status: 'moi' }, { status: 'dang-lam' }]);
  assert.ok(ev[1].actor_id > 0);
  assert.equal((await put(t, code, { status: 'dang-lam' }, '/status')).status, 200);
  assert.equal((await events(t.db, code)).length, 2);
  assert.equal((await put(t, code, { status: 'xyz' }, '/status')).status, 400);
  assert.equal((await put(t, code, {}, '/status')).status, 400);
  assert.equal((await put(t, 'DH000000-999', { status: 'moi' }, '/status')).status, 404);
});

test('sửa giá dòng kích thước riêng: total mới, estimate=false, khách thấy giá mới nhưng không thấy internal_note', async () => {
  const t = await setup();
  const cust = await tokenFor(t.db, 'customer', 'k@example.com');
  const code = await place(t.app, { items: [item(170, 2)] }, cust);
  const before = (await t.db.query('select lines from orders'))[0].lines[0];
  assert.equal(before.estimate, true);
  const r = await put(t, code, { lines: [{ ref: 0, unitPrice: 5100000, qty: 3 }], internal_note: 'chốt giá qua điện thoại' });
  assert.equal(r.status, 200);
  assert.equal(r.body.order.total, 15300000);
  const l = r.body.order.lines[0];
  assert.deepEqual([l.unitPrice, l.qty, l.estimate, l.kind, l.name, l.W], [5100000, 3, false, 'product', before.name, 170]);
  const mine = await request(t.app).get('/api/me/orders/' + code).set(bearer(cust));
  assert.equal(mine.body.order.total, 15300000);
  assert.equal(mine.body.order.lines[0].unitPrice, 5100000);
  assert.ok(!JSON.stringify(mine.body).includes('chốt giá'));
  const ev = (await events(t.db, code))[1];
  assert.equal(ev.kind, 'sua');
  assert.deepEqual(Object.keys(ev.before).sort(), ['internal_note', 'lines', 'total']);
  assert.equal(ev.before.total, 9980000);
  assert.equal(ev.after.total, 15300000);
  assert.equal(ev.after.internal_note, 'chốt giá qua điện thoại');
});

test('giữ nguyên giá mà đổi số lượng -> vẫn tạm tính; thêm phí 150000 và giảm -50000 -> total đúng', async () => {
  const t = await setup();
  const code = await place(t.app, { items: [item(170, 1)] });
  const r = await put(t, code, { lines: [
    { ref: 0, unitPrice: 4990000, qty: 2 },
    { kind: 'extra', label: '  Phí giao hàng ', amount: 150000 },
    { kind: 'extra', label: 'Giảm giá', amount: -50000 }
  ] });
  assert.equal(r.status, 200);
  assert.equal(r.body.order.total, 4990000 * 2 + 150000 - 50000);
  assert.equal(r.body.order.lines[0].estimate, true);
  assert.deepEqual(r.body.order.lines.slice(1), [{ kind: 'extra', label: 'Phí giao hàng', amount: 150000 }, { kind: 'extra', label: 'Giảm giá', amount: -50000 }]);
  // ref trỏ vào dòng phụ phí (vị trí 1) -> 400: dòng phí không phải dòng sản phẩm
  assert.equal((await put(t, code, { lines: [{ ref: 1, unitPrice: 1, qty: 1 }] })).status, 400);
  // bỏ các dòng phí bằng cách không gửi lại chúng
  const r2 = await put(t, code, { lines: [{ ref: 0, unitPrice: 4990000, qty: 1 }] });
  assert.equal(r2.body.order.total, 4990000);
  assert.equal(r2.body.order.lines.length, 1);
});

test('ref sai, ref trùng, thiếu dòng, giá/số lượng/dòng phụ sai, total âm -> 400 và đơn không đổi', async () => {
  const t = await setup();
  const code = await place(t.app, { items: [item(160, 1), item(170, 1)] });
  const ok = { ref: 0, unitPrice: 4810000, qty: 1 };
  const bad = [
    [{ ref: 2, unitPrice: 1, qty: 1 }], [{ ref: -1, unitPrice: 1, qty: 1 }], [{ ref: 0.5, unitPrice: 1, qty: 1 }], [{ unitPrice: 1, qty: 1 }],
    [ok, { ...ok }],
    [], 'x',
    [{ ...ok, unitPrice: -1 }], [{ ...ok, unitPrice: 1.5 }], [{ ...ok, qty: 0 }], [{ ...ok, qty: 51 }],
    [ok, { kind: 'extra', label: ' ', amount: 5 }], [ok, { kind: 'extra', label: 'x'.repeat(101), amount: 5 }],
    [ok, { kind: 'extra', label: 'a', amount: 0 }], [ok, { kind: 'extra', label: 'a', amount: 1.5 }], [ok, { kind: 'extra', label: 'a', amount: 2e9 }],
    [ok, { kind: 'other' }], [ok, null],
    [{ ...ok, unitPrice: 1000 }, { kind: 'extra', label: 'Giảm', amount: -5000 }]
  ];
  for (const lines of bad) {
    const r = await put(t, code, { lines });
    assert.equal(r.status, 400, JSON.stringify(lines));
    assert.ok(r.body.error);
  }
  const [o] = await t.db.query('select total, lines from orders');
  assert.equal(Number(o.total), 4810000 + 4990000);
  assert.equal(o.lines.length, 2);
  assert.equal((await events(t.db, code)).length, 1);
});

test('sửa thông tin khách / thanh toán dùng lại luật kiểm tra của lúc đặt; chỉ trường gửi lên mới đổi', async () => {
  const t = await setup();
  const code = await place(t.app, {});
  assert.equal((await put(t, code, { customer: { name: '', phone: '0386115316', address: 'x' } })).status, 400);
  assert.equal((await put(t, code, { customer: { name: 'A', phone: '123', address: 'x' } })).status, 400);
  assert.equal((await put(t, code, { payment: 'the' })).status, 400);
  assert.equal((await put(t, code, { internal_note: 'x'.repeat(2001) })).status, 400);
  const r = await put(t, code, { customer: { name: ' Lê Cường ', phone: '+84 912 345 678', address: '5 Hai Bà Trưng' }, payment: 'chuyen-khoan' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.order.customer, { name: 'Lê Cường', phone: '0912345678', address: '5 Hai Bà Trưng' });
  assert.equal(r.body.order.payment, 'chuyen-khoan');
  assert.equal(r.body.order.total, 9620000);
  const ev = (await events(t.db, code))[1];
  assert.deepEqual(Object.keys(ev.after).sort(), ['customer', 'payment']);
  assert.equal(ev.before.customer.name, 'Nguyễn An');
  assert.equal((await put(t, 'DH000000-999', { internal_note: 'a' })).status, 404);
});

test('sửa không đổi gì (body rỗng) -> 200, không thêm event; updated_at đổi theo đồng hồ khi có sửa', async () => {
  let cur = new Date('2026-10-26T03:00:00Z');
  const t = await newTestApp({ now: () => cur, config: { orderRateLimit: 1000 } });
  await t.db.query('insert into products (id, code, data, hidden, updated_at) values (1,$1,$2,false,now())', ['MA1', JSON.stringify(rowOf(1))]);
  t.admin = await tokenFor(t.db, 'admin');
  const code = await place(t.app, {});
  cur = new Date('2026-10-26T05:00:00Z');
  assert.equal((await put(t, code, {})).status, 200);
  assert.equal((await events(t.db, code)).length, 1);
  await put(t, code, { internal_note: 'a' });
  const [o] = await t.db.query('select updated_at from orders');
  assert.equal(new Date(o.updated_at).toISOString(), '2026-10-26T05:00:00.000Z');
});
