// Đọc file .env ở thư mục gốc (nếu có) vào process.env. Biến đã đặt sẵn (ví dụ trên Render) không bị ghi đè.
const fs = require('fs');
const path = require('path');

function loadEnvFile(file = path.join(__dirname, '..', '.env')) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

module.exports = { loadEnvFile };
