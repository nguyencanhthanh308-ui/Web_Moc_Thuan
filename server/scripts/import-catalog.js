const fs = require('fs');
const vm = require('vm');
const { publishCatalog } = require('../services/catalog');

const DEFAULT_SOURCE = 'https://raw.githubusercontent.com/nguyencanhthanh308-ui/Web_Moc_Thuan/main/assets/js/catalog.js';

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

async function loadSource(src) {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Không tải được ${src} (HTTP ${res.status}).`);
    return res.text();
  }
  return fs.readFileSync(src, 'utf8');
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
  } finally {
    await pool.end();
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { importCatalog, parseCatalog };
