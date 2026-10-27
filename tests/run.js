/* Chạy mọi tests/*.test.js (không đệ quy, nên bỏ qua tests/ui/ chạy bằng Edge).
   Node 18 không tự mở rộng dấu *, và npm trên Windows cũng không, nên liệt kê file ở đây. */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort().map(f => path.join(__dirname, f));
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
