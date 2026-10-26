const { Pool } = require('pg');
const { loadConfig } = require('./config');
const { createDb, migrate } = require('./db');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig(process.env);
  const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: local ? false : { rejectUnauthorized: false } });
  const db = createDb(pool);
  await migrate(db);
  // storage và mailer thật được nối ở các task sau
  const app = createApp({ db, storage: null, mailer: null, config });
  app.listen(config.port, () => console.log('Máy chủ chạy ở cổng ' + config.port));
}

main().catch(e => { console.error(e); process.exit(1); });
