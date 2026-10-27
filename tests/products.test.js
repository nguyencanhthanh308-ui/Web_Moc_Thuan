const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { newTestApp, tokenFor, FakeStorage } = require('./helpers');
const { importCatalog } = require('../server/scripts/import-catalog');
const { catalogText } = require('../server/services/catalog');
const { createStorage } = require('../server/services/storage');

const bearer = t => ({ Authorization: 'Bearer ' + t });
const rowOf = (id, o = {}) => ({ id, code: 'MA' + id, sub: 'ban-giam-doc', kind: 'desk_exec', style: 'có hộc', name: 'Bàn ' + id,
  prices: [[160, 4810000], [180, 5170000]], W: 160, wood: 'trang', frame: 'den', uph: 'den', sale: 0, isNew: false, order: id, photos: [], ...o });
const SAMPLE = catalogText({
  rev: '2026-01-01T00:00:00',
  woodK: { caosu: 1, soi: 1.1 },
  products: [rowOf(1001), rowOf(1002, { hidden: true }), rowOf(1003, { flag: true })]
});
const readCatalog = storage => new Function(storage.files.get('catalog.js').buffer.toString('utf8') + ';return CATALOG')();

async function setup(overrides) {
  const t = await newTestApp(overrides);
  t.token = await tokenFor(t.db, 'admin');
  await importCatalog(t.db, t.storage, SAMPLE, t.app.locals.deps.now);
  return t;
}

test('import 3 sản phẩm mẫu: GET trả đủ, giữ id/code/hidden, chạy lại không nhân đôi', async () => {
  const { app, db, storage, token } = await setup();
  await importCatalog(db, storage, SAMPLE);
  const r = await request(app).get('/api/admin/products').set(bearer(token));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.products.map(p => [p.id, p.code, p.hidden]), [[1001, 'MA1001', false], [1002, 'MA1002', true], [1003, 'MA1003', false]]);
  assert.deepEqual(r.body.woodK, { caosu: 1, soi: 1.1 });
  const cat = readCatalog(storage);
  assert.deepEqual(cat.products.map(p => p.id), [1001, 1003]);
  assert.equal(storage.files.get('catalog.js').contentType, 'text/javascript; charset=utf-8');
  assert.equal(storage.files.get('catalog.js').options.cacheControl, 'max-age=60');
});

test('rev theo giờ Việt Nam từ now() đã tiêm', async () => {
  const { storage } = await setup({ now: () => new Date('2026-10-26T20:30:05Z') });
  assert.equal(readCatalog(storage).rev, '2026-10-27T03:30:05');
});

test('import: file chạy mã độc không đụng được biến toàn cục', async () => {
  const { db, storage } = await setup();
  await assert.rejects(importCatalog(db, storage, 'process.exit(1);var CATALOG={products:[]}'), /process/);
});

test('chưa đăng nhập 401, token khách 403', async () => {
  const { app, db } = await setup();
  assert.equal((await request(app).get('/api/admin/products')).status, 401);
  const khach = await tokenFor(db, 'customer');
  assert.equal((await request(app).get('/api/admin/products').set(bearer(khach))).status, 403);
  assert.equal((await request(app).put('/api/admin/products/1001').set(bearer(khach)).send({ product: rowOf(1001) })).status, 403);
  assert.equal((await request(app).post('/api/admin/products/bulk-price').set(bearer(khach)).send({ ids: [1001], percent: 10 })).status, 403);
  assert.equal((await request(app).put('/api/admin/settings/woodK').set(bearer(khach)).send({ woodK: { soi: 1 } })).status, 403);
});

test('PUT sửa giá: catalog.js mới chứa giá mới', async () => {
  const { app, storage, token } = await setup();
  const r = await request(app).put('/api/admin/products/1001').set(bearer(token)).send({ product: rowOf(1001, { prices: [[160, 7770000]] }) });
  assert.equal(r.status, 200);
  assert.deepEqual(readCatalog(storage).products.find(p => p.id === 1001).prices, [[160, 7770000]]);
});

test('PUT hidden:true: catalog.js không còn sản phẩm, GET admin vẫn có; tạo mới cũng được', async () => {
  const { app, storage, token } = await setup();
  assert.equal((await request(app).put('/api/admin/products/1001').set(bearer(token)).send({ product: rowOf(1001, { hidden: true }) })).status, 200);
  assert.ok(!readCatalog(storage).products.some(p => p.id === 1001));
  const list = (await request(app).get('/api/admin/products').set(bearer(token))).body.products;
  assert.equal(list.find(p => p.id === 1001).hidden, true);
  assert.equal((await request(app).put('/api/admin/products/2000').set(bearer(token)).send({ product: rowOf(2000) })).status, 200);
  assert.ok(readCatalog(storage).products.some(p => p.id === 2000));
});

test('mã trùng 409, sửa chính nó giữ nguyên mã thì được', async () => {
  const { app, token } = await setup();
  const dup = await request(app).put('/api/admin/products/3000').set(bearer(token)).send({ product: rowOf(3000, { code: 'MA1001' }) });
  assert.equal(dup.status, 409);
  assert.ok(dup.body.error);
  assert.equal((await request(app).put('/api/admin/products/1001').set(bearer(token)).send({ product: rowOf(1001) })).status, 200);
});

test('kiểm tra dữ liệu: 400 với thông báo tiếng Việt', async () => {
  const { app, token } = await setup();
  const put = p => request(app).put('/api/admin/products/4000').set(bearer(token)).send({ product: p });
  for (const bad of [
    rowOf(4000, { prices: [] }), rowOf(4000, { prices: [[4, 100000]] }), rowOf(4000, { prices: [[100, 0]] }),
    rowOf(4000, { prices: [[100, 'x']] }), rowOf(4000, { kind: 'khong-co' }), rowOf(4000, { kind: '__proto__' }),
    rowOf(4000, { sub: '' }), rowOf(4000, { code: ' ' }), rowOf(4000, { name: '' }), null
  ]) {
    const r = await put(bad);
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.ok(r.body.error);
  }
  assert.equal((await request(app).put('/api/admin/products/abc').set(bearer(token)).send({ product: rowOf(1) })).status, 400);
});

test('bulk +10% làm tròn 10.000, tối thiểu 10.000', async () => {
  const { app, token, storage } = await setup();
  await request(app).put('/api/admin/products/1001').set(bearer(token)).send({ product: rowOf(1001, { prices: [[160, 4810000], [180, 12000]] }) });
  const r = await request(app).post('/api/admin/products/bulk-price').set(bearer(token)).send({ ids: [1001, 1002], percent: 10 });
  assert.equal(r.status, 200);
  assert.equal(r.body.updated, 2);
  const list = (await request(app).get('/api/admin/products').set(bearer(token))).body.products;
  assert.deepEqual(list.find(p => p.id === 1001).prices, [[160, 5290000], [180, 10000]]);
  assert.deepEqual(list.find(p => p.id === 1002).prices, [[160, 5290000], [180, 5690000]]);
  assert.deepEqual(readCatalog(storage).products.find(p => p.id === 1001).prices, [[160, 5290000], [180, 10000]]);
  const down = await request(app).post('/api/admin/products/bulk-price').set(bearer(token)).send({ ids: [1001], percent: -90 });
  assert.equal(down.status, 200);
  assert.deepEqual((await request(app).get('/api/admin/products').set(bearer(token))).body.products.find(p => p.id === 1001).prices, [[160, 530000], [180, 10000]]);
});

test('bulk: ids/percent sai thì 400', async () => {
  const { app, token } = await setup();
  const post = b => request(app).post('/api/admin/products/bulk-price').set(bearer(token)).send(b);
  for (const b of [{ ids: [], percent: 10 }, { ids: ['a'], percent: 10 }, { ids: [1.5], percent: 10 }, { ids: [1001], percent: 'x' },
    { ids: [1001], percent: 1e9 }, { ids: [1001], percent: -100 }, { ids: [1001] }, {}]) {
    assert.equal((await post(b)).status, 400, JSON.stringify(b));
  }
});

test('xoá: sản phẩm thường 204 và biến khỏi catalog, flag:true bị 409, không có thì 404', async () => {
  const { app, token, storage } = await setup();
  assert.equal((await request(app).delete('/api/admin/products/1003').set(bearer(token))).status, 409);
  assert.equal((await request(app).delete('/api/admin/products/1001').set(bearer(token))).status, 204);
  assert.deepEqual(readCatalog(storage).products.map(p => p.id), [1003]);
  assert.equal((await request(app).delete('/api/admin/products/1001').set(bearer(token))).status, 404);
});

test('woodK: lưu và xuất vào catalog.js, ngoài [0.5, 3] thì 400', async () => {
  const { app, token, storage } = await setup();
  const ok = await request(app).put('/api/admin/settings/woodK').set(bearer(token)).send({ woodK: { caosu: 1, soi: 1.25 } });
  assert.equal(ok.status, 200);
  assert.deepEqual(readCatalog(storage).woodK, { caosu: 1, soi: 1.25 });
  for (const w of [{ soi: 0.4 }, { soi: 3.1 }, { soi: 'x' }, { la: 1 }, {}, null]) {
    assert.equal((await request(app).put('/api/admin/settings/woodK').set(bearer(token)).send({ woodK: w })).status, 400, JSON.stringify(w));
  }
});

test('tên có dấu nháy và thẻ HTML: catalog.js đọc lại đúng chuỗi', async () => {
  const { app, token, storage } = await setup();
  // Không đặt dấu cách ngay sau dấu gạch chéo ngược: pg-mem phân tích sai chuỗi đó (Postgres thật thì không)
  const name = 'Bàn "góc" <b>\\</script>';
  assert.equal((await request(app).put('/api/admin/products/1001').set(bearer(token)).send({ product: rowOf(1001, { name }) })).status, 200);
  assert.equal(readCatalog(storage).products.find(p => p.id === 1001).name, name);
});

test('Storage lỗi sau khi ghi DB: 502 với thông báo, dữ liệu DB vẫn giữ', async () => {
  const storage = new FakeStorage();
  const { app, token, db } = await setup({ storage });
  storage.put = async () => { throw new Error('Storage hỏng'); };
  const r = await request(app).put('/api/admin/products/1001').set(bearer(token)).send({ product: rowOf(1001, { prices: [[160, 9990000]] }) });
  assert.equal(r.status, 502);
  assert.equal(r.body.error, 'Đã lưu vào hệ thống nhưng chưa cập nhật được trang web. Bấm Lưu lại để thử lại.');
  const rows = await db.query('select data from products where id = 1001');
  assert.deepEqual(rows[0].data.prices, [[160, 9990000]]);
});

test('createStorage: URL công khai, header, và lỗi HTTP không lộ khoá', async () => {
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts) => { calls.push({ url, opts }); return calls.length === 1 ? { ok: true } : { ok: false, status: 403, text: async () => 'Từ chối' }; };
  try {
    const s = createStorage({ supabaseUrl: 'https://abc.supabase.co/', serviceKey: 'KHOA-BI-MAT', bucket: 'products' });
    assert.equal(s.publicUrl('catalog.js'), 'https://abc.supabase.co/storage/v1/object/public/products/catalog.js');
    assert.equal(await s.put('catalog.js', Buffer.from('x'), 'text/javascript', { cacheControl: 'max-age=60' }), s.publicUrl('catalog.js'));
    assert.equal(calls[0].url, 'https://abc.supabase.co/storage/v1/object/products/catalog.js');
    assert.equal(calls[0].opts.headers['x-upsert'], 'true');
    assert.equal(calls[0].opts.headers['cache-control'], 'max-age=60');
    assert.equal(calls[0].opts.headers.Authorization, 'Bearer KHOA-BI-MAT');
    assert.equal(calls[0].opts.headers.apikey, 'KHOA-BI-MAT');
    assert.ok(calls[0].opts.signal, 'phải có hạn chót (timeout)');
    await assert.rejects(s.put('a.txt', Buffer.from('x'), 'text/plain'), e => /403/.test(e.message) && /Từ chối/.test(e.message) && !/KHOA-BI-MAT/.test(e.message));
  } finally { global.fetch = realFetch; }
});

const { loadSource, findRelativeAssets, relativeAssetsWarning, DEFAULT_SOURCE, FALLBACK_SOURCE } = require('../server/scripts/import-catalog');

test('import-catalog: địa chỉ mặc định 404 thì thử public/, địa chỉ tự chọn thì không', async () => {
  const calls = [];
  const fakeFetch = status => async url => { calls.push(url); return { status: url === FALLBACK_SOURCE ? 200 : status, ok: (url === FALLBACK_SOURCE ? 200 : status) === 200, url, text: async () => 'var CATALOG={products:[]}' }; };
  assert.equal(await loadSource(DEFAULT_SOURCE, fakeFetch(404)), 'var CATALOG={products:[]}');
  assert.deepEqual(calls, [DEFAULT_SOURCE, FALLBACK_SOURCE]);
  calls.length = 0;
  await assert.rejects(loadSource('https://example.com/c.js', fakeFetch(404)), /404/);
  assert.deepEqual(calls, ['https://example.com/c.js']);
});

test('import-catalog: cảnh báo ảnh/mô hình dùng đường dẫn tương đối', () => {
  const list = findRelativeAssets([
    { id: 1, code: 'A1', photos: ['assets/img/products/a.jpg', 'https://x.test/b.jpg'] },
    { id: 2, code: 'A2', photos: [], model: { src: 'assets/models/a.glb' } },
    { id: 3, code: 'A3', photos: ['https://x.test/c.jpg'], model: { src: 'http://x.test/c.glb' } },
    { id: 4, code: 'A4' }
  ]);
  assert.deepEqual(list, [{ id: 1, code: 'A1', paths: ['assets/img/products/a.jpg'] }, { id: 2, code: 'A2', paths: ['assets/models/a.glb'] }]);
  const w = relativeAssetsWarning(list);
  assert.match(w, /A1.*a\.jpg/);
  assert.match(w, /A2.*a\.glb/);
  assert.match(w, /public\/assets/);
  assert.equal(relativeAssetsWarning([]), '');
});
