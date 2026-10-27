const express = require('express');
const MT = require('../../public/assets/js/shared.js');
const { requireAdmin } = require('../auth');
const { publishCatalog, readWoodK } = require('../services/catalog');

const PUBLISH_FAIL = 'Đã lưu vào hệ thống nhưng chưa cập nhật được trang web. Bấm Lưu lại để thử lại.';
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const toId = v => (/^\d+$/.test(String(v)) && Number(v) > 0 && Number(v) <= 2147483647 ? Number(v) : null);

// Trả thông báo lỗi tiếng Việt, hoặc null nếu hợp lệ
function validateProduct(p) {
  if (!isObj(p)) return 'Thiếu dữ liệu sản phẩm.';
  if (typeof p.code !== 'string' || !p.code.trim()) return 'Mã sản phẩm không được để trống.';
  if (typeof p.name !== 'string' || !p.name.trim()) return 'Tên sản phẩm không được để trống.';
  if (typeof p.sub !== 'string' || !p.sub.trim()) return 'Cần chọn danh mục cho sản phẩm.';
  if (typeof p.kind !== 'string' || !Object.prototype.hasOwnProperty.call(MT.K, p.kind)) return 'Dáng sản phẩm không hợp lệ.';
  if (!Array.isArray(p.prices) || !p.prices.length) return 'Cần có ít nhất một mức giá.';
  for (const row of p.prices) {
    if (!Array.isArray(row) || row.length !== 2 || !Number.isFinite(row[0]) || !Number.isFinite(row[1])) return 'Bảng giá không hợp lệ.';
    if (row[0] < 5) return 'Chiều dài trong bảng giá phải từ 5 cm trở lên.';
    if (row[1] <= 0) return 'Giá phải lớn hơn 0.';
  }
  return null;
}

const UPSERT = `insert into products (id, code, data, hidden, updated_at) values ($1,$2,$3,$4,$5)
  on conflict (id) do update set code = excluded.code, data = excluded.data, hidden = excluded.hidden, updated_at = excluded.updated_at`;

module.exports = function productsRouter({ db, storage, now }) {
  const router = express.Router();
  router.use(requireAdmin);

  // true nếu đã đưa lên được, false nếu đã trả 502 (dữ liệu trong DB vẫn được giữ)
  const publish = res => publishCatalog(db, storage, now).then(
    () => true,
    e => { console.error('Không đưa được catalog.js lên Storage', e); res.status(502).json({ error: PUBLISH_FAIL }); return false; });

  router.get('/products', async (req, res) => {
    const rows = await db.query('select data, hidden from products order by id');
    res.json({ woodK: await readWoodK(db), products: rows.map(r => ({ ...r.data, hidden: r.hidden })) });
  });

  router.put('/products/:id', async (req, res) => {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Mã sản phẩm trong đường dẫn không hợp lệ.' });
    const product = req.body && req.body.product;
    const bad = validateProduct(product);
    if (bad) return res.status(400).json({ error: bad });
    const { hidden, ...rest } = product;
    const data = { ...rest, id, code: rest.code.trim() };
    const dup = await db.query('select id from products where code = $1 and id <> $2', [data.code, id]);
    if (dup.length) return res.status(409).json({ error: 'Mã sản phẩm "' + data.code + '" đã có sản phẩm khác dùng.' });
    await db.query(UPSERT, [id, data.code, JSON.stringify(data), hidden === true, now()]);
    if (!(await publish(res))) return;
    res.json({ product: { ...data, hidden: hidden === true } });
  });

  router.delete('/products/:id', async (req, res) => {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Mã sản phẩm trong đường dẫn không hợp lệ.' });
    const rows = await db.query('select data from products where id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
    if (rows[0].data.flag === true) return res.status(409).json({ error: 'Sản phẩm này được dùng cho mô hình riêng của web nên không xoá được. Hãy ẩn nó đi.' });
    await db.query('delete from products where id = $1', [id]);
    if (!(await publish(res))) return;
    res.status(204).end();
  });

  router.post('/products/bulk-price', async (req, res) => {
    const { ids, percent } = req.body || {};
    if (!Array.isArray(ids) || !ids.length || !ids.every(i => Number.isInteger(i) && i > 0)) return res.status(400).json({ error: 'Chưa chọn sản phẩm nào.' });
    if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < -90 || percent > 500) return res.status(400).json({ error: 'Phần trăm thay đổi phải nằm trong khoảng từ -90 đến 500.' });
    const updated = await db.tx(async tx => {
      let n = 0;
      for (const id of [...new Set(ids)]) {
        const rows = await tx.query('select data from products where id = $1', [id]);
        if (!rows.length) continue;
        const data = rows[0].data;
        data.prices = data.prices.map(([w, price]) => [w, Math.max(10000, Math.round(price * (1 + percent / 100) / 10000) * 10000)]);
        await tx.query('update products set data = $1, updated_at = $2 where id = $3', [JSON.stringify(data), now(), id]);
        n++;
      }
      return n;
    });
    if (!(await publish(res))) return;
    res.json({ updated });
  });

  router.put('/settings/woodK', async (req, res) => {
    const woodK = req.body && req.body.woodK;
    const woodIds = MT.WOOD.map(w => w.id);
    if (!isObj(woodK) || !Object.keys(woodK).length) return res.status(400).json({ error: 'Thiếu hệ số chất liệu.' });
    for (const [k, v] of Object.entries(woodK)) {
      if (!woodIds.includes(k)) return res.status(400).json({ error: 'Chất liệu không hợp lệ: ' + k });
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0.5 || v > 3) return res.status(400).json({ error: 'Hệ số chất liệu phải nằm trong khoảng từ 0,5 đến 3.' });
    }
    await db.query(
      "insert into settings (key, value) values ('woodK', $1) on conflict (key) do update set value = excluded.value",
      [JSON.stringify(woodK)]);
    if (!(await publish(res))) return;
    res.json({ woodK });
  });

  return router;
};
