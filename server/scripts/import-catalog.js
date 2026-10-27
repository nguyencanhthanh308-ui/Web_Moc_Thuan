const fs = require('fs');
const vm = require('vm');
const { publishCatalog } = require('../services/catalog');

const DEFAULT_SOURCE = 'https://raw.githubusercontent.com/nguyencanhthanh308-ui/Web_Moc_Thuan/main/assets/js/catalog.js';
// Sau khi nhánh bán hàng được gộp vào main, file nằm trong public/
const FALLBACK_SOURCE = 'https://raw.githubusercontent.com/nguyencanhthanh308-ui/Web_Moc_Thuan/main/public/assets/js/catalog.js';

// Đọc catalog.js trong vùng cách ly, không có biến toàn cục nào (nguồn tải qua mạng)
function parseCatalog(text) {
  const c = vm.runInNewContext(text + ';CATALOG', {}, { timeout: 1000 });
  if (!c || !Array.isArray(c.products)) throw new Error('File catalog.js không đúng định dạng.');
  return c;
}

const UPSERT = `insert into products (id, code, data, hidden, updated_at) values ($1,$2,$3,$4,$5)
  on conflict (id) do update set code = excluded.code, data = excluded.data, hidden = excluded.hidden, updated_at = excluded.updated_at`;

// Ghi products + woodK trong một transaction (upsert theo id), rồi đưa catalog.js mới lên Storage
async function importCatalog(db, storage, text, now = () => new Date()) {
  const c = parseCatalog(text);
  await db.tx(async tx => {
    for (const row of c.products) {
      const { hidden, ...data } = row;
      await tx.query(UPSERT, [data.id, data.code, JSON.stringify(data), hidden === true, now()]);
    }
    if (c.woodK) {
      await tx.query(
        "insert into settings (key, value) values ('woodK', $1) on conflict (key) do update set value = excluded.value",
        [JSON.stringify(c.woodK)]);
    }
  });
  await publishCatalog(db, storage, now);
  return { count: c.products.length };
}

// Tải nguồn; nếu là địa chỉ mặc định mà trả 404 thì thử địa chỉ mới (public/). fetchFn truyền vào được để test không cần mạng.
async function loadSource(src, fetchFn = fetch) {
  if (/^https?:\/\//i.test(src)) {
    let res = await fetchFn(src);
    if (res.status === 404 && src === DEFAULT_SOURCE) res = await fetchFn(FALLBACK_SOURCE);
    if (!res.ok) throw new Error(`Không tải được ${res.url || src} (HTTP ${res.status}).`);
    return res.text();
  }
  return fs.readFileSync(src, 'utf8');
}

const isRelative = s => typeof s === 'string' && s.trim() !== '' && !/^https?:\/\//i.test(s.trim());

// Liệt kê sản phẩm có ảnh/mô hình 3D dùng đường dẫn tương đối (file nằm trong kho cũ, không tự sang được public/)
function findRelativeAssets(products) {
  const out = [];
  for (const p of products || []) {
    const paths = [];
    for (const ph of Array.isArray(p.photos) ? p.photos : []) if (isRelative(ph)) paths.push(ph);
    if (p.model && isRelative(p.model.src)) paths.push(p.model.src);
    if (paths.length) out.push({ id: p.id, code: p.code, paths });
  }
  return out;
}

function relativeAssetsWarning(list) {
  if (!list.length) return '';
  const lines = list.map(x => `  - sản phẩm ${x.code || x.id}: ${x.paths.join(', ')}`);
  return 'CẢNH BÁO: ' + list.length + ' sản phẩm có ảnh hoặc mô hình 3D dùng đường dẫn tương đối (tải lên bằng trang admin cũ):\n' + lines.join('\n') +
    '\nTrang web mới chỉ phục vụ file trong thư mục public/. Cách xử lý: chép thư mục assets/img/products và assets/models của kho cũ vào public/assets/ (rồi đưa lên GitHub), hoặc tải lại các ảnh/mô hình đó qua trang admin mới.';
}

async function main() {
  require('../load-env').loadEnvFile();
  const { Pool } = require('pg');
  const { loadConfig } = require('../config');
  const { createDb, migrate } = require('../db');
  const { createStorage } = require('../services/storage');
  const config = loadConfig(process.env);
  const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: local ? false : { rejectUnauthorized: false } });
  pool.on('error', e => console.error('Lỗi kết nối DB', e));
  try {
    const db = createDb(pool);
    await migrate(db);
    const storage = createStorage({ supabaseUrl: config.supabaseUrl, serviceKey: config.supabaseServiceKey, bucket: config.storageBucket });
    const text = await loadSource(process.argv[2] || DEFAULT_SOURCE);
    const { count } = await importCatalog(db, storage, text);
    console.log(`Đã nhập ${count} sản phẩm và đưa catalog.js lên Storage.`);
    const warn = relativeAssetsWarning(findRelativeAssets(parseCatalog(text).products));
    if (warn) console.warn(warn);
  } finally {
    await pool.end();
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { importCatalog, parseCatalog, loadSource, findRelativeAssets, relativeAssetsWarning, DEFAULT_SOURCE, FALLBACK_SOURCE };
