require('./load-env').loadEnvFile();
const { Pool } = require('pg');
const { loadConfig } = require('./config');
const { createDb, migrate } = require('./db');
const { createApp } = require('./app');
const { createStorage } = require('./services/storage');
const { createMailer } = require('./services/mailer');

async function main() {
  const config = loadConfig(process.env);
  if (config.nodeEnv === 'production' && !config.corsOrigins.length) {
    console.warn('CẢNH BÁO: CORS_ORIGINS đang trống nên trình duyệt sẽ bị chặn gọi API (đăng nhập, đặt hàng đều lỗi). Hãy điền địa chỉ trang web vào CORS_ORIGINS trên Render.');
  }
  const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: local ? false : { rejectUnauthorized: false } });
  pool.on('error', e => console.error('Lỗi kết nối DB', e));
  const db = createDb(pool);
  await migrate(db);
  const app = createApp({ db, storage: createStorage({ supabaseUrl: config.supabaseUrl, serviceKey: config.supabaseServiceKey, bucket: config.storageBucket }), mailer: createMailer(config.smtp), config });
  app.listen(config.port, () => console.log('Máy chủ chạy ở cổng ' + config.port));
}

main().catch(e => { console.error(e); process.exit(1); });
