// Dựng và đưa catalog.js (danh sách sản phẩm công khai) lên Storage.
const CATALOG_PATH = 'catalog.js';

function catalogText({ rev, woodK, products }) {
  return '/* Mộc Thuận Nội Thất — danh sách sản phẩm và bảng giá\n' +
    '   File này do máy chủ xuất ra (bản ' + rev + '). Nên sửa bằng trang quản lý admin.html thay vì sửa tay.\n' +
    '   Mỗi dòng một sản phẩm: prices = [chiều dài cm, giá ₫ với chất liệu hệ số 1]; W = kích thước mặc định;\n' +
    '   kind + style = dáng và kiểu của mô hình 3D (xem biến K trong data.js); hidden = ngừng bán. */\n"use strict";\n' +
    'var CATALOG = {"rev":' + JSON.stringify(rev) + ',"woodK":' + JSON.stringify(woodK) + ',"products":[\n' +
    products.map(r => JSON.stringify(r)).join(',\n') + '\n]};\n';
}

// Giờ Việt Nam (UTC+7, không có giờ mùa hè), dạng YYYY-MM-DDTHH:MM:SS
function nowRev(now) {
  return new Date(now().getTime() + 7 * 3600 * 1000).toISOString().slice(0, 19);
}

async function readWoodK(db) {
  const rows = await db.query("select value from settings where key = 'woodK'");
  return rows[0] ? rows[0].value : {};
}

async function publishCatalog(db, storage, now = () => new Date()) {
  const rows = await db.query('select data from products where hidden = false order by id');
  const rev = nowRev(now);
  const text = catalogText({ rev, woodK: await readWoodK(db), products: rows.map(r => r.data) });
  await storage.put(CATALOG_PATH, Buffer.from(text, 'utf8'), 'text/javascript; charset=utf-8', { cacheControl: 'max-age=60' });
  return { rev };
}

module.exports = { CATALOG_PATH, catalogText, nowRev, readWoodK, publishCatalog };
