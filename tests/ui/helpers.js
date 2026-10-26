// Tiện ích cho test giao diện: máy chủ tĩnh cho public/, mở Edge, giả lập API bằng page.route
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..', '..', 'public');
const API = 'http://localhost:3000';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.json': 'application/json' };

function startStatic() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); } // web chưa có favicon; trình duyệt tự xin, không phải lỗi của trang
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, 'localhost', () => {
    resolve({ url: 'http://localhost:' + server.address().port + '/', close: () => new Promise(r => server.close(r)) });
  }));
}

const launch = () => chromium.launch({ channel: 'msedge' });

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// handlers: {'POST /api/orders': (req) => ({status, body}) | {status, body}}. /api/health luôn trả ok.
// Trả mảng calls ghi lại mọi lời gọi API (không tính OPTIONS).
async function mockApi(page, handlers = {}) {
  const calls = [];
  await page.route(API + '/api/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const key = req.method() + ' ' + url.pathname;
    let body = null;
    try { body = req.postDataJSON(); } catch (e) { body = req.postData(); }
    const call = { key, body, auth: req.headers().authorization || null };
    calls.push(call);
    let h = handlers[key];
    if (!h && key === 'GET /api/health') h = { status: 200, body: { ok: true } };
    if (!h) h = { status: 404, body: { error: 'Không tìm thấy đường dẫn này.' } };
    const r = typeof h === 'function' ? await h(call, calls.filter(c => c.key === key).length) : h;
    if (r === 'abort') return route.abort('connectionrefused');
    await route.fulfill({ status: r.status || 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(r.body || {}) });
  });
  return calls;
}

// Trang mới: chặn font Google (cho nhanh), ghi lỗi console, đặt sẵn localStorage nếu cần
async function newPage(browser, { width = 1280, height = 900, storage = {} } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (Object.keys(storage).length) {
    await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); Object.keys(s).forEach(k => localStorage.setItem(k, s[k])); } }, storage);
  }
  return { page, errors };
}

// Hai món mẫu có trong catalog.js
const CART = [
  { key: 'p1001160trangdenden', id: 'p1001', W: 160, wood: 'trang', frame: 'den', uph: 'den', qty: 1 },
  { key: 'p1010100soidenbe', id: 'p1010', W: 100, wood: 'soi', frame: 'den', uph: 'be', qty: 2 }
];

const noHorizontalScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

module.exports = { startStatic, launch, mockApi, newPage, CART, API, noHorizontalScroll };
