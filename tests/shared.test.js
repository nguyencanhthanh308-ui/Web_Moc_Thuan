const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const MT = require('../public/assets/js/shared.js');

// Công thức cũ của data.js (priceOf / finalPrice), chép nguyên để so sánh.
function oldPriceOf(p, W, woodK, woodId) {
  const wk = p.k.parts.indexOf('w') >= 0 ? woodK[woodId] : 1;
  return Math.round(MT.priceAt(p.prices, W) * wk / 10000) * 10000;
}
function oldFinalPrice(p, W, woodK, woodId) {
  const b = oldPriceOf(p, W, woodK, woodId);
  return p.sale ? Math.round(b * (1 - p.sale / 100) / 10000) * 10000 : b;
}

test('unitPrice trùng finalPrice cũ với 20 sản phẩm đầu × mọi kích thước × mọi chất liệu', () => {
  const ctx = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/assets/js/catalog.js'), 'utf8') + ';this.CATALOG=CATALOG', ctx);
  const woodK = ctx.CATALOG.woodK;
  const products = ctx.CATALOG.products.slice(0, 20);
  assert.equal(products.length, 20);
  let n = 0;
  for (const r of products) {
    const p = { kind: r.kind, prices: r.prices, sale: +r.sale || 0, k: MT.K[r.kind] };
    for (const [W] of r.prices) for (const w of MT.WOOD) {
      assert.equal(MT.unitPrice(p, W, w.id, woodK), oldFinalPrice(p, W, woodK, w.id), `${r.code} W=${W} ${w.id}`);
      n++;
    }
  }
  assert.ok(n > 100);
});

test('unitPrice dùng hệ số của WOOD khi woodK thiếu chất liệu', () => {
  const p = { kind: 'desk', prices: [[100, 1000000]], sale: 0 };
  assert.equal(MT.unitPrice(p, 100, 'soi', {}), 1100000);
});

test('priceAt nội suy và kéo dài', () => {
  assert.equal(MT.priceAt([[100, 1e6], [120, 1.2e6]], 110), 1.1e6);
  assert.equal(MT.priceAt([[100, 1e6]], 150), 1.5e6);
});

test('customRange', () => {
  assert.deepEqual(MT.customRange([160, 180]), { min: 96, max: 252, step: 5 });
  assert.deepEqual(MT.customRange([25]), { min: 20, max: 35, step: 5 });
});
