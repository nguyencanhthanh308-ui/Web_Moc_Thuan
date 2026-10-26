const { Pool } = require('pg');
const { loadConfig } = require('./config');
const { createDb, migrate } = require('./db');
const { createApp } = require('./app');
const { createStorage } = require('./services/storage');

async function main() {
  const config = loadConfig(process.env);
  const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: local ? false : { rejectUnauthorized: false } });
  pool.on('error', e => console.error('Lỗi kết nối DB', e));
  const db = createDb(pool);
  await migrate(db);
  // mailer thật được nối ở task sau
  const app = createApp({ db, storage: createStorage({ supabaseUrl: config.supabaseUrl, serviceKey: config.supabaseServiceKey, bucket: config.storageBucket }), mailer: null, config });
  app.listen(config.port, () => console.log('Máy chủ chạy ở cổng ' + config.port));
}

main().catch(e => { console.error(e); process.exit(1); });
