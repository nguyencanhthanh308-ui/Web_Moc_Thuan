const { hashPassword, normEmail } = require('../auth');

// Trả 'created' hoặc 'promoted'
async function createOrPromoteAdmin(db, rawEmail, password) {
  const email = normEmail(rawEmail);
  if (!email) throw new Error('Thiếu email.');
  if (typeof password !== 'string' || password.length < 8) throw new Error('Mật khẩu cần có ít nhất 8 ký tự.');
  const hash = await hashPassword(password);
  const found = await db.query('select id from users where email = $1', [email]);
  if (found.length) {
    await db.query("update users set role = 'admin', password_hash = $1 where id = $2", [hash, found[0].id]);
    return 'promoted';
  }
  await db.query("insert into users (email, password_hash, role, name) values ($1,$2,'admin',$3)", [email, hash, 'Quản trị']);
  return 'created';
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => { s += d; });
    process.stdin.on('end', () => resolve(s));
    process.stdin.on('error', reject);
    if (process.stdin.isTTY) process.stderr.write('Nhập mật khẩu (ít nhất 8 ký tự), rồi nhấn Enter: ');
  });
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error('Cách dùng: node server/scripts/create-admin.js <email>');
  const { Pool } = require('pg');
  const { loadConfig } = require('../config');
  const { createDb, migrate } = require('../db');
  const config = loadConfig(process.env);
  const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl);
  const pool = new Pool({ connectionString: config.databaseUrl, ssl: local ? false : { rejectUnauthorized: false } });
  try {
    const password = (await readStdin()).split(/\r?\n/)[0];
    const db = createDb(pool);
    await migrate(db);
    const result = await createOrPromoteAdmin(db, email, password);
    console.log(result === 'created' ? `Đã tạo tài khoản quản trị: ${normEmail(email)}` : `Đã nâng ${normEmail(email)} lên quản trị và đặt lại mật khẩu.`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { createOrPromoteAdmin };
