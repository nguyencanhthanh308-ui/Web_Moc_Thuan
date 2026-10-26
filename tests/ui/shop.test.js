// Test giao diện khách (Edge qua playwright-core): nạp sản phẩm, đặt hàng với API chập chờn, đăng nhập, Đơn của tôi, màn hình 390px
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startStatic, launch, mockApi, newPage, CART, noHorizontalScroll } = require('./helpers');

let site, browser;
before(async () => { site = await startStatic(); browser = await launch(); });
after(async () => { await browser.close(); await site.close(); });

const cartStorage = () => ({ 'mocthuan-cart': JSON.stringify(CART) });
const cartLen = page => page.evaluate(() => (JSON.parse(localStorage.getItem('mocthuan-cart')) || []).length);

const ADMIN = { id: 1, email: 'chu@mocthuan.vn', role: 'admin', name: 'Chủ xưởng', phone: '0386115316', address: 'Xưởng' };
const CUSTOMER = { id: 2, email: 'an@example.com', role: 'customer', name: 'Nguyễn An', phone: '0912345678', address: '12 Lê Lợi, Huế' };

async function openCheckout(page) {
  await page.goto(site.url);
  await page.waitForSelector('.card');
  await page.evaluate(() => { Api.retryMs = 20; });
  await page.click('#cartBtn');
  await page.click('#checkout');
  await page.waitForSelector('#orderForm');
}
async function fillAndSend(page) {
  await page.fill('#o-name', 'Trần Bình');
  await page.fill('#o-phone', '0912 345 678');
  await page.fill('#o-addr', '5 Hùng Vương, Đà Nẵng');
  await page.check('input[name=payment][value=khi-nhan]');
  await page.click('#orderForm button[type=submit]');
}

describe('trang chủ', () => {
  it('hiện sản phẩm, không lỗi console, số cửa hàng mới', async () => {
    const { page, errors } = await newPage(browser);
    await mockApi(page);
    await page.goto(site.url);
    await page.waitForSelector('.card');
    const footer = await page.textContent('footer');
    assert.match(footer, /0386 115 316/);
    assert.match(footer, /Sản phẩm và giá trên web là dữ liệu minh họa\. Ảnh sản phẩm được dựng 3D trực tiếp trong trình duyệt\./);
    assert.equal(await page.locator('a[href="tel:0386115316"]').count() >= 1, true);
    const html = await page.content();
    assert.equal(html.includes('0900 000 000'), false);
    assert.equal(await page.locator('#acct >> text=Đăng nhập').isVisible(), true);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('gọi /api/health khi mở trang để đánh thức máy chủ', async () => {
    const { page } = await newPage(browser);
    await mockApi(page);
    const health = page.waitForRequest(r => r.url() === 'http://localhost:3000/api/health' && r.method() === 'GET', { timeout: 5000 });
    await page.goto(site.url);
    await health;
    await page.close();
  });

  it('catalogUrl lỗi thì vẫn hiện sản phẩm từ catalog.js dự phòng', async () => {
    const { page } = await newPage(browser);
    await mockApi(page);
    let asked = false;
    await page.route('**/assets/js/config.js', route => route.fulfill({ status: 200, contentType: 'text/javascript',
      body: "var MT_CONFIG = {apiBase:'http://localhost:3000', catalogUrl:'https://kho.example.test/catalog.js'};" }));
    await page.route('https://kho.example.test/**', route => { asked = true; return route.abort('connectionrefused'); });
    await page.goto(site.url);
    await page.waitForSelector('.card');
    assert.equal(asked, true);
    assert.ok(await page.locator('.card').count() > 0);
    await page.close();
  });
});

describe('đặt hàng', () => {
  it('API 503 hai lần rồi 201: giỏ chỉ trống sau 201, hiện mã đơn', async () => {
    const { page } = await newPage(browser, { storage: cartStorage() });
    const seen = [];
    const calls = await mockApi(page, {
      'POST /api/orders': async (call, n) => {
        seen.push({ len: await cartLen(page), disabled: await page.evaluate(() => document.querySelector('#orderForm button[type=submit]').disabled) });
        return n < 3 ? { status: 503, body: {} } : { status: 201, body: { code: 'DH261026-007' } };
      }
    });
    await openCheckout(page);
    await fillAndSend(page);
    await page.waitForSelector('text=DH261026-007');
    const text = await page.textContent('#layer');
    assert.match(text, /Cửa hàng đã nhận đơn DH261026-007 và sẽ gọi lại để xác nhận/);
    assert.doesNotMatch(text, /thành công/i);
    assert.deepEqual(seen, [{ len: 2, disabled: true }, { len: 2, disabled: true }, { len: 2, disabled: true }]);
    assert.equal(await cartLen(page), 0);
    assert.equal(await page.isHidden('#cartCount'), true);
    const sent = calls.filter(c => c.key === 'POST /api/orders')[0].body;
    assert.deepEqual(sent.items, [
      { id: 1001, W: 160, wood: 'trang', frame: 'den', uph: 'den', qty: 1 },
      { id: 1010, W: 100, wood: 'soi', frame: 'den', uph: 'be', qty: 2 }
    ]);
    assert.deepEqual(sent.customer, { name: 'Trần Bình', phone: '0912 345 678', address: '5 Hùng Vương, Đà Nẵng' });
    assert.equal(sent.payment, 'khi-nhan');
    assert.equal(sent.website, '');
    const ids = calls.filter(c => c.key === 'POST /api/orders').map(c => c.body.requestId);
    assert.equal(ids.length, 3);
    assert.match(ids[0], /^[A-Za-z0-9-]{8,64}$/);
    assert.deepEqual(ids, [ids[0], ids[0], ids[0]]);
    await page.close();
  });

  // giữ phản hồi của POST /api/orders tới khi test gọi release(kết quả)
  function heldOrders() {
    let release, arrived;
    const gate = new Promise(r => { release = r; });
    const first = new Promise(r => { arrived = r; });
    return { first, release: r => release(r), handler: () => { arrived(); return gate; } };
  }

  it('đóng form khi đang gửi rồi bấm đặt hàng lại: không gửi đơn thứ hai', async () => {
    const { page, errors } = await newPage(browser, { storage: cartStorage() });
    const held = heldOrders();
    const calls = await mockApi(page, { 'POST /api/orders': held.handler });
    await openCheckout(page);
    await fillAndSend(page);
    await held.first;
    await page.click('#layer [data-x]');
    assert.equal(await page.locator('#orderForm').count(), 0);
    await page.click('#cartBtn');
    await page.click('#checkout');
    await page.waitForSelector('#layer >> text=vẫn đang được gửi');
    assert.equal(await page.locator('#orderForm').count(), 0);
    held.release({ status: 201, body: { code: 'DH261026-010' } });
    await page.waitForSelector('#layer >> text=DH261026-010');
    assert.equal(calls.filter(c => c.key === 'POST /api/orders').length, 1);
    assert.equal(await cartLen(page), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('422 về sau khi đã đóng form: bỏ món, hiện thông báo, không lỗi', async () => {
    const { page, errors } = await newPage(browser, { storage: cartStorage() });
    const held = heldOrders();
    await mockApi(page, { 'POST /api/orders': held.handler });
    await openCheckout(page);
    await fillAndSend(page);
    await held.first;
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#orderForm').count(), 0);
    held.release({ status: 422, body: { error: 'Có sản phẩm trong giỏ hiện không còn bán.', unavailable: [1001] } });
    await page.waitForSelector('#layer >> text=Bàn giám đốc có hộc 3 ngăn');
    assert.match(await page.textContent('#layer'), /không còn bán/);
    assert.equal(await page.textContent('#cartCount'), '2');
    await page.click('#noticeCart');
    await page.click('#checkout');
    await page.waitForSelector('#orderForm');
    // trình duyệt tự ghi "Failed to load resource ... 422" cho phản hồi lỗi HTTP; chỉ bắt lỗi của trang
    assert.deepEqual(errors.filter(e => !/Failed to load resource: .* 422/.test(e)), []);
    await page.close();
  });

  it('API 503 mãi: giữ nguyên giỏ, báo gọi 0386 115 316', async () => {
    const { page } = await newPage(browser, { storage: cartStorage() });
    const calls = await mockApi(page, { 'POST /api/orders': { status: 503, body: {} } });
    await openCheckout(page);
    await fillAndSend(page);
    await page.waitForSelector('#o-status >> text=0386 115 316');
    assert.match(await page.textContent('#o-status'), /Chưa gửi được đơn\. Vui lòng gọi 0386 115 316/);
    assert.equal(calls.filter(c => c.key === 'POST /api/orders').length, 5);
    assert.equal(await cartLen(page), 2);
    assert.equal(await page.textContent('#cartCount'), '3');
    assert.equal(await page.isEnabled('#orderForm button[type=submit]'), true);
    await page.close();
  });

  it('API 422 unavailable: bỏ món đó, giữ món còn lại', async () => {
    const { page } = await newPage(browser, { storage: cartStorage() });
    await mockApi(page, { 'POST /api/orders': { status: 422, body: { error: 'Có sản phẩm trong giỏ hiện không còn bán, vui lòng bỏ khỏi giỏ rồi gửi lại.', unavailable: [1001] } } });
    await openCheckout(page);
    await fillAndSend(page);
    await page.waitForSelector('#o-status >> text=Bàn giám đốc có hộc 3 ngăn');
    const left = await page.evaluate(() => JSON.parse(localStorage.getItem('mocthuan-cart')).map(it => it.id));
    assert.deepEqual(left, ['p1010']);
    assert.equal(await page.textContent('#cartCount'), '2');
    await page.close();
  });

  it('đã đăng nhập thì tự điền tên, số điện thoại, địa chỉ', async () => {
    const { page } = await newPage(browser, { storage: { ...cartStorage(), 'mocthuan-token': 'tok-khach' } });
    await mockApi(page, { 'GET /api/auth/me': { body: { user: CUSTOMER } } });
    await page.goto(site.url);
    await page.waitForSelector('#acctBtn');
    await page.click('#cartBtn');
    await page.click('#checkout');
    assert.equal(await page.inputValue('#o-name'), 'Nguyễn An');
    assert.equal(await page.inputValue('#o-phone'), '0912345678');
    assert.equal(await page.inputValue('#o-addr'), '12 Lê Lợi, Huế');
    await page.close();
  });
});

describe('tài khoản', () => {
  it('admin có link Quản trị', async () => {
    const { page } = await newPage(browser, { storage: { 'mocthuan-token': 'tok-admin' } });
    const calls = await mockApi(page, { 'GET /api/auth/me': { body: { user: ADMIN } } });
    await page.goto(site.url);
    await page.waitForSelector('#acctBtn');
    assert.match(await page.textContent('#acctBtn'), /Chủ xưởng/);
    await page.click('#acctBtn');
    const menu = page.locator('#acctMenu');
    assert.equal(await menu.isVisible(), true);
    assert.equal(await menu.locator('a[href="admin.html"]', { hasText: 'Quản trị' }).count(), 1);
    assert.equal(await menu.locator('text=Đơn của tôi').count(), 1);
    assert.equal(await menu.locator('text=Thông tin tài khoản').count(), 1);
    assert.equal(await menu.locator('text=Đăng xuất').count(), 1);
    assert.equal(calls.find(c => c.key === 'GET /api/auth/me').auth, 'Bearer tok-admin');
    await page.close();
  });

  it('khách không có link Quản trị', async () => {
    const { page } = await newPage(browser, { storage: { 'mocthuan-token': 'tok-khach' } });
    await mockApi(page, { 'GET /api/auth/me': { body: { user: CUSTOMER } } });
    await page.goto(site.url);
    await page.waitForSelector('#acctBtn');
    await page.click('#acctBtn');
    assert.equal(await page.locator('#acctMenu a[href="admin.html"]').count(), 0);
    assert.equal(await page.locator('text=Quản trị').count(), 0);
    await page.close();
  });

  it('đăng nhập bằng form rồi đăng xuất', async () => {
    const { page } = await newPage(browser);
    const calls = await mockApi(page, {
      'POST /api/auth/login': call => call.body.password === 'dung-mat-khau'
        ? { body: { token: 'tok-moi', user: CUSTOMER } } : { status: 401, body: { error: 'Email hoặc mật khẩu không đúng' } },
      'POST /api/auth/logout': { body: { ok: true } }
    });
    await page.goto(site.url + '#dang-nhap');
    await page.fill('#l-email', 'an@example.com');
    await page.fill('#l-pass', 'sai');
    await page.click('#loginForm button[type=submit]');
    await page.waitForSelector('#loginForm >> text=Email hoặc mật khẩu không đúng');
    await page.fill('#l-pass', 'dung-mat-khau');
    await page.click('#loginForm button[type=submit]');
    await page.waitForSelector('#acctBtn >> text=Nguyễn An');
    assert.equal(await page.evaluate(() => localStorage.getItem('mocthuan-token')), 'tok-moi');
    await page.click('#acctBtn');
    await page.click('#acctMenu >> text=Đăng xuất');
    await page.waitForSelector('#acct >> text=Đăng nhập');
    assert.equal(await page.evaluate(() => localStorage.getItem('mocthuan-token')), null);
    assert.equal(calls.find(c => c.key === 'POST /api/auth/logout').auth, 'Bearer tok-moi');
    await page.close();
  });

  it('401 từ API thì xóa token và hiện lại nút Đăng nhập', async () => {
    const { page } = await newPage(browser, { storage: { 'mocthuan-token': 'tok-het-han' } });
    await mockApi(page, { 'GET /api/auth/me': { status: 401, body: { error: 'Bạn cần đăng nhập.' } } });
    await page.goto(site.url);
    await page.waitForFunction(() => localStorage.getItem('mocthuan-token') === null);
    assert.equal(await page.locator('#acct >> text=Đăng nhập').isVisible(), true);
    await page.close();
  });
});

describe('Đơn của tôi', () => {
  const ORDER = {
    code: 'DH261020-003', status: 'da-xac-nhan', statusLabel: 'Đã xác nhận', customer: { name: 'Nguyễn An', phone: '0912345678', address: '12 Lê Lợi, Huế' },
    payment: 'chuyen-khoan', total: 5310000, note: 'Giao <buổi sáng>', created_at: '2026-10-20T03:00:00.000Z', updated_at: '2026-10-21T03:00:00.000Z',
    lines: [
      { kind: 'product', productId: 1001, code: 'MA1001', name: 'Bàn giám đốc <b>có hộc</b>', W: 165, D: 80, H: 76, woodName: 'Melamine trắng', frameName: 'Sơn đen', uphName: null, qty: 1, unitPrice: 4810000, custom: true, estimate: true },
      { kind: 'extra', label: 'Phí giao hàng', amount: 600000 },
      { kind: 'extra', label: 'Khách quen', amount: -100000 }
    ]
  };
  const storage = { 'mocthuan-token': 'tok-khach' };

  it('#don-cua-toi hiện danh sách từ API', async () => {
    const { page } = await newPage(browser, { storage });
    const calls = await mockApi(page, { 'GET /api/auth/me': { body: { user: CUSTOMER } }, 'GET /api/me/orders': { body: { orders: [ORDER] } } });
    await page.goto(site.url + '#don-cua-toi');
    await page.waitForSelector('text=DH261020-003');
    const text = await page.textContent('#app');
    assert.match(text, /Đã xác nhận/);
    assert.match(text, /5\.310\.000/);
    assert.equal(await page.locator('a[href="#don=DH261020-003"]').count(), 1);
    assert.equal(calls.find(c => c.key === 'GET /api/me/orders').auth, 'Bearer tok-khach');
    await page.close();
  });

  it('#don=<code> hiện dòng sản phẩm, phụ phí, giảm giá, giá tạm tính (đã esc)', async () => {
    const { page, errors } = await newPage(browser, { storage });
    await mockApi(page, { 'GET /api/auth/me': { body: { user: CUSTOMER } }, 'GET /api/me/orders/DH261020-003': { body: { order: ORDER } } });
    await page.goto(site.url + '#don=DH261020-003');
    await page.waitForSelector('text=Bàn giám đốc <b>có hộc</b>');
    const text = await page.textContent('#app');
    assert.match(text, /giá tạm tính/);
    assert.match(text, /Phí giao hàng/);
    assert.match(text, /Khách quen/);
    assert.match(text, /giảm giá/i);
    assert.match(text, /100\.000/);
    assert.match(text, /Chuyển khoản/);
    assert.match(text, /Đã xác nhận/);
    assert.match(text, /Giao <buổi sáng>/);
    assert.equal(await page.locator('#app b:text-is("có hộc")').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('chưa đăng nhập thì #don-cua-toi mời đăng nhập', async () => {
    const { page } = await newPage(browser);
    await mockApi(page);
    await page.goto(site.url + '#don-cua-toi');
    await page.waitForSelector('#loginForm');
    await page.close();
  });
});

describe('màn hình 390px', () => {
  it('không cuộn ngang ở trang chủ, giỏ hàng, form đặt hàng, đăng nhập, menu tài khoản', async () => {
    const { page } = await newPage(browser, { width: 390, height: 844, storage: cartStorage() });
    await mockApi(page, { 'GET /api/auth/me': { body: { user: ADMIN } } });
    await page.goto(site.url);
    await page.waitForSelector('.card');
    assert.equal(await noHorizontalScroll(page), true, 'trang chủ');
    await page.click('#cartBtn');
    assert.equal(await noHorizontalScroll(page), true, 'giỏ hàng');
    await page.click('#checkout');
    await page.waitForSelector('#orderForm');
    assert.equal(await noHorizontalScroll(page), true, 'form đặt hàng');
    await page.keyboard.press('Escape');
    await page.goto(site.url + '#dang-nhap');
    await page.waitForSelector('#loginForm');
    assert.equal(await noHorizontalScroll(page), true, 'đăng nhập');
    await page.goto(site.url + '#dang-ky');
    await page.waitForSelector('#registerForm');
    assert.equal(await noHorizontalScroll(page), true, 'đăng ký');
    await page.evaluate(() => localStorage.setItem('mocthuan-token', 'tok-admin'));
    await page.goto(site.url + '#home');
    await page.reload();
    await page.waitForSelector('#acctBtn');
    await page.click('#acctBtn');
    assert.equal(await noHorizontalScroll(page), true, 'menu tài khoản');
    const box = await page.locator('#acctMenu').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390, 'menu nằm trong màn hình');
    await page.close();
  });
});
