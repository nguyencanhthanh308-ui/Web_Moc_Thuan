// Test giao diện trang quản trị (Edge qua playwright-core): đăng nhập, sản phẩm qua API, tải ảnh, tab Đơn hàng, màn hình 390px
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { startStatic, launch, mockApi, newPage, noHorizontalScroll } = require('./helpers');

let site, browser;
before(async () => { site = await startStatic(); browser = await launch(); });
after(async () => { await browser.close(); await site.close(); });

const CAT = (() => {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'assets', 'js', 'catalog.js'), 'utf8') + ';this.CAT = CATALOG;', ctx);
  return ctx.CAT;
})();
const clone = o => JSON.parse(JSON.stringify(o));

const ADMIN = { id: 1, email: 'chu@mocthuan.vn', role: 'admin', name: 'Chủ xưởng', phone: '0386115316', address: 'Xưởng' };
const CUSTOMER = { id: 2, email: 'an@example.com', role: 'customer', name: 'Nguyễn An', phone: '0912345678', address: '12 Lê Lợi, Huế' };
const TOKEN = { 'mocthuan-token': 'tok-admin' };
const CODE = 'DH261026-001';
const PUBLISH_FAIL = 'Đã lưu vào hệ thống nhưng chưa cập nhật được trang web. Bấm Lưu lại để thử lại.';

const ORDER = {
  code: CODE, status: 'moi', statusLabel: 'Mới', payment: 'khi-nhan',
  customer: { name: 'Trần Bình', phone: '0912345678', address: '5 Hùng Vương, Đà Nẵng' },
  lines: [
    { productId: 1001, code: 'MA1001', name: 'Bàn giám đốc có hộc 3 ngăn', W: 160, D: 80, H: 75, wood: 'trang', frame: 'den', uph: null,
      woodName: 'Gỗ trắng', frameName: 'Đen', uphName: null, kind: 'product', qty: 1, unitPrice: 4570000, custom: false, estimate: false },
    { productId: 1010, code: 'MA1010', name: 'Ghế ăn <b>gỗ</b>', W: 100, D: 45, H: 80, wood: 'soi', frame: 'den', uph: 'be',
      woodName: 'Gỗ sồi', frameName: 'Đen', uphName: 'Be', kind: 'product', qty: 2, unitPrice: 2500000, custom: true, estimate: true },
    { kind: 'extra', label: 'Phí giao hàng', amount: 200000 }
  ],
  total: 9770000, note: '<img src=x onerror="window.__xss=1">Giao giờ hành chính', internal_note: null,
  created_at: '2026-10-26T03:00:00.000Z', updated_at: '2026-10-26T03:00:00.000Z',
  events: [
    { kind: 'tao', before: null, after: { status: 'moi', total: 9770000 }, at: '2026-10-26T03:00:00.000Z', actor_email: null },
    { kind: 'sua', before: { internal_note: null }, after: { internal_note: 'Gọi trước khi giao' }, at: '2026-10-26T04:00:00.000Z', actor_email: 'chu@mocthuan.vn' }
  ]
};
const ROW = (() => { const r = clone(ORDER); delete r.events; return r; })();

// API giả cho admin đã đăng nhập; extra ghi đè từng đường dẫn
function adminApi(extra = {}) {
  return {
    'GET /api/auth/me': { body: { user: ADMIN } },
    'GET /api/admin/products': () => ({ body: { woodK: clone(CAT.woodK), products: clone(CAT.products).map(p => ({ ...p, hidden: false })) } }),
    'GET /api/admin/orders': { body: { orders: [ROW], total: 1, counts: { moi: 3, 'dang-lam': 1 } } },
    ['GET /api/admin/orders/' + CODE]: () => ({ body: { order: clone(ORDER) } }),
    ...extra
  };
}

async function openAdmin(page, hash = '') {
  await page.goto(site.url + 'admin.html' + hash);
  await page.evaluate(() => { Api.retryMs = 20; });
  await page.waitForSelector('.adm-tabs [data-tab=orders]', { state: 'visible' });
}
async function openProduct(page, id = 1001) {
  await page.click('.adm-tabs [data-tab=list]');
  await page.click('.prow[data-id="' + id + '"]');
  await page.waitForSelector('#edSave');
}
async function openOrder(page) {
  await openAdmin(page, '#don=' + CODE);
  await page.waitForSelector('#ordDetail [data-st]');
}
const count = (calls, key) => calls.filter(c => c.key === key).length;
const puts = (calls, key) => calls.filter(c => c.key === key).map(c => c.body);
async function login(page, token = 'tok-new') {
  await page.fill('#a-email', 'chu@mocthuan.vn');
  await page.fill('#a-pass', 'mat-khau-dai');
  await page.click('#admLogin button[type=submit]');
  return token;
}

describe('đăng nhập trang quản trị', () => {
  it('không có token: hiện form đăng nhập, không tải sản phẩm hay đơn', async () => {
    const { page, errors } = await newPage(browser);
    const calls = await mockApi(page, adminApi());
    await page.goto(site.url + 'admin.html');
    await page.waitForSelector('#admLogin');
    await page.waitForTimeout(300);
    assert.equal(count(calls, 'GET /api/admin/products'), 0);
    assert.equal(count(calls, 'GET /api/admin/orders'), 0);
    assert.equal(await page.isHidden('.adm-tabs'), true);
    assert.equal(await page.isHidden('#logoutBtn'), true);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('có token, máy chủ chưa trả lời: báo đang kết nối', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    let release;
    const gate = new Promise(r => { release = r; });
    await mockApi(page, adminApi({ 'GET /api/auth/me': () => gate }));
    await page.goto(site.url + 'admin.html');
    await page.waitForSelector('text=Đang kết nối máy chủ…');
    release({ body: { user: ADMIN } });
    await page.waitForSelector('.adm-tabs [data-tab=orders]', { state: 'visible' });
    await page.close();
  });

  it('đăng nhập admin: tải 300 sản phẩm bằng token, hiện tên và Đăng xuất', async () => {
    const { page, errors } = await newPage(browser);
    const calls = await mockApi(page, adminApi({ 'POST /api/auth/login': { body: { token: 'tok-new', user: ADMIN } } }));
    await page.goto(site.url + 'admin.html');
    await page.waitForSelector('#admLogin');
    await login(page);
    await page.waitForSelector('.adm-tabs [data-tab=orders]', { state: 'visible' });
    await page.click('.adm-tabs [data-tab=list]');
    await page.waitForSelector('.adm-count');
    assert.match(await page.textContent('.adm-count'), /^300 sản phẩm\./);
    assert.equal(await page.locator('.prow[data-id]').count(), 40);
    const get = calls.filter(c => c.key === 'GET /api/admin/products')[0];
    assert.equal(get.auth, 'Bearer tok-new');
    assert.match(await page.textContent('.adm-head'), /Chủ xưởng/);
    assert.equal(await page.isVisible('#logoutBtn'), true);
    assert.equal(await page.isVisible('a#openWeb'), true);
    const head = await page.textContent('.adm-head');
    assert.doesNotMatch(head, /GitHub|Xuất file|Xem thử/);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('tài khoản khách: báo không có quyền, không tải dữ liệu', async () => {
    const { page } = await newPage(browser);
    const calls = await mockApi(page, adminApi({ 'POST /api/auth/login': { body: { token: 'tok-kh', user: CUSTOMER } } }));
    await page.goto(site.url + 'admin.html');
    await page.waitForSelector('#admLogin');
    await login(page);
    await page.waitForSelector('#admLogin .form-msg.err');
    assert.match(await page.textContent('#admLogin .form-msg'), /không có quyền quản trị/);
    assert.equal(count(calls, 'GET /api/admin/products'), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('mocthuan-token')), null);
    await page.close();
  });

  it('Đăng xuất quay về form đăng nhập', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    await mockApi(page, adminApi({ 'POST /api/auth/logout': { status: 204 } }));
    await openAdmin(page);
    await page.click('#logoutBtn');
    await page.waitForSelector('#admLogin');
    assert.equal(await page.isHidden('.adm-tabs'), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('mocthuan-token')), null);
    await page.close();
  });
});

describe('sản phẩm qua API', () => {
  it('sửa giá rồi Lưu: đúng một PUT với giá mới, đóng ngăn sửa', async () => {
    const { page, errors } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({ 'PUT /api/admin/products/1001': c => ({ body: { product: c.body.product } }) }));
    await openAdmin(page);
    await page.click('.adm-tabs [data-tab=list]');
    const before = await page.textContent('.prow[data-id="1001"] .pr');
    await openProduct(page);
    await page.fill('.szP[data-i="0"]', '5.000.000');
    await page.click('#edSave');
    await page.waitForSelector('.drawer.ed', { state: 'detached' });
    const sent = puts(calls, 'PUT /api/admin/products/1001');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].product.id, 1001);
    assert.deepEqual(sent[0].product.prices[0], [160, 5000000]);
    assert.equal(calls.filter(c => c.key === 'PUT /api/admin/products/1001')[0].auth, 'Bearer tok-admin');
    assert.notEqual(await page.textContent('.prow[data-id="1001"] .pr'), before);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('API trả 500: ngăn sửa vẫn mở, nội dung đang sửa còn nguyên', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({ 'PUT /api/admin/products/1001': { status: 500, body: { error: 'Máy chủ gặp lỗi.' } } }));
    await openAdmin(page);
    await openProduct(page);
    await page.fill('#fName', 'Bàn đang sửa dở');
    await page.fill('.szP[data-i="0"]', '5.000.000');
    await page.click('#edSave');
    await page.waitForFunction(() => document.querySelector('#edErr').textContent.length > 0);
    assert.match(await page.textContent('#edErr'), /Máy chủ gặp lỗi/);
    assert.equal(await page.isVisible('.drawer.ed'), true);
    assert.equal(await page.inputValue('#fName'), 'Bàn đang sửa dở');
    assert.equal((await page.inputValue('.szP[data-i="0"]')).replace(/\D/g, ''), '5000000');
    assert.equal(count(calls, 'PUT /api/admin/products/1001'), 1);
    assert.equal(await page.isEnabled('#edSave'), true);
    await page.close();
  });

  it('API trả 502 (đã lưu, chưa cập nhật web): báo cảnh báo, ngăn sửa vẫn mở', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    await mockApi(page, adminApi({ 'PUT /api/admin/products/1001': { status: 502, body: { error: PUBLISH_FAIL } } }));
    await openAdmin(page);
    await openProduct(page);
    await page.fill('#fName', 'Bàn đã lưu DB');
    await page.click('#edSave');
    await page.waitForFunction(() => document.querySelector('#edErr').textContent.length > 0);
    assert.match(await page.textContent('#edErr'), /chưa cập nhật được trang web/);
    assert.equal(await page.isVisible('.drawer.ed'), true);
    assert.equal(await page.inputValue('#fName'), 'Bàn đã lưu DB');
    await page.close();
  });

  it('401 khi Lưu: về form đăng nhập, đăng nhập lại thì ngăn sửa còn nguyên và Lưu được', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({
      'PUT /api/admin/products/1001': (c, n) => (n === 1 ? { status: 401, body: { error: 'Phiên đăng nhập đã hết hạn.' } } : { body: { product: c.body.product } }),
      'POST /api/auth/login': { body: { token: 'tok-new', user: ADMIN } }
    }));
    await openAdmin(page);
    await openProduct(page);
    await page.fill('#fName', 'Bàn chưa kịp lưu');
    await page.click('#edSave');
    await page.waitForSelector('#admLogin');
    assert.equal(await page.isHidden('.drawer.ed'), true);
    await login(page);
    await page.waitForSelector('.drawer.ed', { state: 'visible' });
    assert.equal(await page.inputValue('#fName'), 'Bàn chưa kịp lưu');
    await page.click('#edSave');
    await page.waitForSelector('.drawer.ed', { state: 'detached' });
    const all = calls.filter(c => c.key === 'PUT /api/admin/products/1001');
    assert.equal(all.length, 2);
    assert.equal(all[1].auth, 'Bearer tok-new');
    assert.equal(all[1].body.product.name, 'Bàn chưa kịp lưu');
    await page.close();
  });

  it('chọn ảnh: gọi uploads?kind=photo, photos có URL trả về', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const URL_IMG = 'https://kho.example.test/products/ban-abc123.jpg';
    await page.route('https://kho.example.test/**', route => route.fulfill({ status: 404, body: '' }));
    const calls = await mockApi(page, adminApi({
      'POST /api/admin/uploads': { body: { url: URL_IMG } },
      'PUT /api/admin/products/1001': c => ({ body: { product: c.body.product } })
    }));
    await openAdmin(page);
    await openProduct(page);
    const req = page.waitForRequest(r => r.url().startsWith('http://localhost:3000/api/admin/uploads') && r.method() === 'POST');
    await page.setInputFiles('#fFiles', { name: 'bàn.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]) });
    const r = await req;
    assert.equal(new URL(r.url()).searchParams.get('kind'), 'photo');
    assert.match(r.headers()['content-type'], /^multipart\/form-data/);
    await page.waitForSelector('.ph-list .mono >> text=' + URL_IMG);
    assert.equal(calls.filter(c => c.key === 'POST /api/admin/uploads')[0].auth, 'Bearer tok-admin');
    await page.click('#edSave');
    await page.waitForSelector('.drawer.ed', { state: 'detached' });
    assert.deepEqual(puts(calls, 'PUT /api/admin/products/1001')[0].product.photos, [URL_IMG]);
    await page.close();
  });

  it('chọn .glb: gọi uploads?kind=model, model.src là URL trả về', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const URL_GLB = 'https://kho.example.test/models/ban-xyz789.glb';
    await page.route('https://kho.example.test/**', route => route.fulfill({ status: 404, body: '' }));
    await mockApi(page, adminApi({ 'POST /api/admin/uploads': { body: { url: URL_GLB } } }));
    await openAdmin(page);
    await openProduct(page);
    const req = page.waitForRequest(r => r.url().startsWith('http://localhost:3000/api/admin/uploads') && r.method() === 'POST');
    await page.setInputFiles('#mFile', { name: 'ban.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from('glTF0000') });
    assert.equal(new URL((await req).url()).searchParams.get('kind'), 'model');
    await page.waitForSelector('.model-file .mono >> text=' + URL_GLB);
    await page.close();
  });

  it('Xóa gọi DELETE; đổi giá hàng loạt gọi bulk-price; hệ số chất liệu gửi đủ mọi chất liệu', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({
      'DELETE /api/admin/products/1002': { status: 204 },
      'POST /api/admin/products/bulk-price': c => ({ body: { updated: c.body.ids.length } }),
      'PUT /api/admin/settings/woodK': c => ({ body: { woodK: c.body.woodK } })
    }));
    await openAdmin(page);
    await openProduct(page, 1002);
    await page.evaluate(() => { window.confirm = () => true; });
    await page.click('#edDel');
    await page.waitForSelector('.drawer.ed', { state: 'detached' });
    assert.equal(count(calls, 'DELETE /api/admin/products/1002'), 1);
    assert.equal(await page.locator('.prow[data-id="1002"]').count(), 0);

    await page.fill('#fq', 'MA1001');
    await page.click('#bulkBtn');
    await page.fill('#bPct', '10');
    await page.click('#bGo');
    await page.waitForFunction(() => !document.querySelector('#bGo'));
    assert.deepEqual(puts(calls, 'POST /api/admin/products/bulk-price'), [{ ids: [1001], percent: 10 }]);

    await page.click('.adm-tabs [data-tab=wood]');
    await page.fill('#wk-soi', '1.2');
    await page.click('#woodSave');
    await page.waitForFunction(() => /Đã lưu/.test(document.querySelector('#status').textContent));
    assert.deepEqual(puts(calls, 'PUT /api/admin/settings/woodK'), [{ woodK: { ...CAT.woodK, soi: 1.2 } }]);
    await page.close();
  });
});

describe('tab Đơn hàng', () => {
  it('là tab đầu tiên, hiện số đơn Mới và danh sách đơn', async () => {
    const { page, errors } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi());
    await openAdmin(page);
    assert.equal(await page.getAttribute('.adm-tabs [role=tab]:first-child', 'data-tab'), 'orders');
    await page.waitForSelector('#newCount:not([hidden])');
    assert.equal(await page.textContent('#newCount'), '3');
    await page.waitForSelector('.ord-row');
    assert.match(await page.textContent('.ord-row'), /DH261026-001[\s\S]*Trần Bình[\s\S]*9\.770\.000/);
    assert.ok(count(calls, 'GET /api/admin/orders') >= 1);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('lọc và tìm gửi status, q lên API', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const urls = [];
    page.on('request', r => { if (r.url().startsWith('http://localhost:3000/api/admin/orders?')) urls.push(new URL(r.url()).searchParams); });
    await mockApi(page, adminApi());
    await openAdmin(page);
    await page.waitForSelector('.ord-row');
    await page.selectOption('#ostatus', 'moi');
    await page.fill('#oq', 'Bình');
    await page.waitForTimeout(600);
    const lastQ = urls[urls.length - 1];
    assert.equal(lastQ.get('status'), 'moi');
    assert.equal(lastQ.get('q'), 'Bình');
    await page.close();
  });

  it('#don=<mã> mở chi tiết: dòng hàng, khách, lịch sử (đã esc)', async () => {
    const { page, errors } = await newPage(browser, { storage: TOKEN });
    await mockApi(page, adminApi());
    await openOrder(page);
    const text = await page.textContent('#ordDetail');
    assert.match(text, /DH261026-001/);
    assert.match(text, /Ghế ăn <b>gỗ<\/b>/);
    assert.match(text, /giá tạm tính/);
    assert.equal(await page.inputValue('.olL[data-i="2"]'), 'Phí giao hàng');
    assert.equal(await page.inputValue('.olP[data-i="0"]'), '4.570.000');
    assert.match(text, /chu@mocthuan\.vn/);
    assert.match(text, /Tạo đơn/);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.equal(await page.inputValue('#c-name'), 'Trần Bình');
    assert.match(await page.textContent('[data-st].next'), /Đã xác nhận/);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('đổi sang Đã hủy phải xác nhận; bước thường thì không hỏi', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({
      ['PUT /api/admin/orders/' + CODE + '/status']: c => ({ body: { order: { ...clone(ORDER), status: c.body.status } } })
    }));
    await openOrder(page);
    await page.evaluate(() => { window.__asked = []; window.confirm = m => { window.__asked.push(m); return false; }; });
    await page.click('[data-st="da-huy"]');
    await page.waitForTimeout(200);
    assert.equal((await page.evaluate(() => window.__asked)).length, 1);
    assert.equal(count(calls, 'PUT /api/admin/orders/' + CODE + '/status'), 0);

    await page.evaluate(() => { window.confirm = m => { window.__asked.push(m); return true; }; });
    await page.click('[data-st="da-huy"]');
    await page.waitForSelector('[data-st="da-huy"][aria-pressed="true"]');
    assert.deepEqual(puts(calls, 'PUT /api/admin/orders/' + CODE + '/status'), [{ status: 'da-huy' }]);
    assert.equal((await page.evaluate(() => window.__asked)).length, 2);

    await page.click('[data-st="da-xac-nhan"]');
    await page.waitForSelector('[data-st="da-xac-nhan"][aria-pressed="true"]');
    assert.equal((await page.evaluate(() => window.__asked)).length, 2);
    await page.close();
  });

  it('mở lại đơn Hoàn tất phải xác nhận', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({
      ['GET /api/admin/orders/' + CODE]: { body: { order: { ...clone(ORDER), status: 'hoan-tat', statusLabel: 'Hoàn tất' } } }
    }));
    await openOrder(page);
    await page.evaluate(() => { window.__asked = 0; window.confirm = () => { window.__asked++; return false; }; });
    await page.click('[data-st="dang-lam"]');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__asked), 1);
    assert.equal(count(calls, 'PUT /api/admin/orders/' + CODE + '/status'), 0);
    await page.close();
  });

  it('sửa giá dòng: PUT đơn với unitPrice mới, ref theo vị trí dòng', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({ ['PUT /api/admin/orders/' + CODE]: { body: { order: clone(ORDER) } } }));
    await openOrder(page);
    await page.fill('.olP[data-i="0"]', '4.000.000');
    await page.click('#olSave');
    await page.waitForFunction(() => /Đã lưu/.test(document.querySelector('#olMsg').textContent));
    assert.deepEqual(puts(calls, 'PUT /api/admin/orders/' + CODE), [{ lines: [
      { ref: 0, unitPrice: 4000000, qty: 1 },
      { ref: 1, unitPrice: 2500000, qty: 2 },
      { kind: 'extra', label: 'Phí giao hàng', amount: 200000 }
    ] }]);
    await page.close();
  });

  it('xóa dòng, thêm giảm giá, sửa khách và ghi chú nội bộ', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    const calls = await mockApi(page, adminApi({ ['PUT /api/admin/orders/' + CODE]: { body: { order: clone(ORDER) } } }));
    await openOrder(page);
    await page.click('[data-rml="0"]');
    await page.click('#olAddDisc');
    await page.fill('.olL[data-i="2"]', 'Khách quen');
    await page.fill('.olA[data-i="2"]', '100.000');
    assert.match(await page.textContent('#olTotal'), /5\.100\.000/);
    await page.click('#olSave');
    await page.waitForFunction(() => /Đã lưu/.test(document.querySelector('#olMsg').textContent));

    await page.fill('#c-phone', '0987654321');
    await page.check('input[name=c-pay][value=chuyen-khoan]');
    await page.click('#custSave');
    await page.waitForFunction(() => /Đã lưu/.test(document.querySelector('#custMsg').textContent));

    await page.fill('#c-inote', 'Khách hẹn chiều thứ bảy');
    await page.click('#noteSave');
    await page.waitForFunction(() => /Đã lưu/.test(document.querySelector('#noteMsg').textContent));

    assert.deepEqual(puts(calls, 'PUT /api/admin/orders/' + CODE), [
      { lines: [{ ref: 1, unitPrice: 2500000, qty: 2 }, { kind: 'extra', label: 'Phí giao hàng', amount: 200000 }, { kind: 'extra', label: 'Khách quen', amount: -100000 }] },
      { customer: { name: 'Trần Bình', phone: '0987654321', address: '5 Hùng Vương, Đà Nẵng' }, payment: 'chuyen-khoan' },
      { internal_note: 'Khách hẹn chiều thứ bảy' }
    ]);
    await page.close();
  });

  it('lỗi khi lưu dòng hàng: báo lỗi, giữ nguyên số đang sửa', async () => {
    const { page } = await newPage(browser, { storage: TOKEN });
    await mockApi(page, adminApi({ ['PUT /api/admin/orders/' + CODE]: { status: 400, body: { error: 'Tổng tiền không được âm.' } } }));
    await openOrder(page);
    await page.fill('.olP[data-i="0"]', '1.234.000');
    await page.click('#olSave');
    await page.waitForSelector('#olMsg.err');
    assert.match(await page.textContent('#olMsg'), /Tổng tiền không được âm/);
    assert.equal(await page.inputValue('.olP[data-i="0"]'), '1.234.000');
    await page.close();
  });
});

describe('web khách không còn chế độ xem thử', () => {
  it('index.html?xem-thu với bản nháp cũ vẫn hiện catalog.js, không có thanh xem thử', async () => {
    const draft = { data: { woodK: CAT.woodK, products: [{ ...CAT.products[0], name: 'Bản nháp cũ' }] } };
    const { page, errors } = await newPage(browser, { storage: { 'mocthuan-admin-draft': JSON.stringify(draft) } });
    await mockApi(page);
    await page.goto(site.url + 'index.html?xem-thu');
    await page.waitForSelector('.card');
    assert.equal(await page.locator('.preview-bar').count(), 0);
    assert.equal((await page.content()).includes('Bản nháp cũ'), false);
    assert.deepEqual(errors, []);
    await page.close();
  });
});

describe('màn hình 390px', () => {
  it('không cuộn ngang ở đăng nhập, danh sách đơn, chi tiết đơn, danh sách sản phẩm, ngăn sửa', async () => {
    const { page: p1 } = await newPage(browser, { width: 390, height: 844 });
    await mockApi(p1, adminApi());
    await p1.goto(site.url + 'admin.html');
    await p1.waitForSelector('#admLogin');
    assert.equal(await noHorizontalScroll(p1), true, 'đăng nhập');
    await p1.close();

    const { page } = await newPage(browser, { width: 390, height: 844, storage: TOKEN });
    await mockApi(page, adminApi());
    await openAdmin(page);
    await page.waitForSelector('.ord-row');
    assert.equal(await noHorizontalScroll(page), true, 'danh sách đơn');
    await page.click('.ord-row');
    await page.waitForSelector('#ordDetail [data-st]');
    assert.equal(await noHorizontalScroll(page), true, 'chi tiết đơn');
    await openProduct(page);
    assert.equal(await noHorizontalScroll(page), true, 'ngăn sửa');
    await page.close();
  });
});
