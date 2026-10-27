const fs = require('fs');
const path = require('path');

// pool: pg.Pool (hoặc pool của pg-mem có cùng giao diện)
function createDb(pool) {
  return {
    async query(sql, params) {
      const r = await pool.query(sql, params);
      return r.rows;
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn({
          async query(sql, params) { return (await client.query(sql, params)).rows; }
        });
        await client.query('commit');
        return out;
      } catch (e) {
        try { await client.query('rollback'); } catch (_) { /* giữ lỗi gốc */ }
        throw e;
      } finally {
        client.release();
      }
    }
  };
}

async function migrate(db) {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(stmt);
}

module.exports = { createDb, migrate };
