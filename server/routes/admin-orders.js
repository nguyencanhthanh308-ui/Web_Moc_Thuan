const express = require('express');
const { requireAdmin } = require('../auth');
const { STATUSES, InputError, parseCustomer, parsePayment, editLines } = require('../services/orders');

const PAGE_SIZE = 30;
const MAX_NOTE = 2000;
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Ký tự % và _ trong ô tìm kiếm là chữ thường, không phải ký tự đại diện của LIKE
const likeEscape = s => s.replace(/[\\%_]/g, c => '\\' + c);

const COLS = 'id, code, status, customer, payment, lines, total, note, internal_note, created_at, updated_at';
const adminOrder = r => ({
  code: r.code, status: r.status, statusLabel: STATUSES[r.status] || r.status, customer: r.customer, payment: r.payment,
  lines: r.lines, total: Number(r.total), note: r.note, internal_note: r.internal_note, created_at: r.created_at, updated_at: r.updated_at
});

module.exports = function adminOrdersRouter({ db, now }) {
  const router = express.Router();
  router.use(requireAdmin);

  async function detail(q, code) {
    const rows = await q.query(`select ${COLS} from orders where code = $1`, [code]);
    if (!rows.length) return null;
    const events = await q.query(
      `select e.kind, e.before, e.after, e.at, u.email as actor_email
       from order_events e left join users u on u.id = e.actor_id
       where e.order_id = $1 order by e.at, e.id`, [rows[0].id]);
    return { ...adminOrder(rows[0]), events };
  }

  router.get('/orders', async (req, res) => {
    const status = req.query.status;
    if (status !== undefined && status !== '' && !has(STATUSES, status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const counts = {};
    for (const r of await db.query('select status, count(*) as n from orders group by status')) counts[r.status] = Number(r.n);

    const where = [];
    const params = [];
    if (status) { params.push(status); where.push('status = $' + params.length); }
    if (q) {
      params.push('%' + likeEscape(q) + '%');
      const ors = [`lower(code) like $${params.length}`, `lower(customer->>'name') like $${params.length}`];
      const digits = q.replace(/[\s.\-]/g, '').replace(/^\+84/, '0');
      if (/^\d{3,}$/.test(digits)) { params.push('%' + digits + '%'); ors.push(`customer->>'phone' like $${params.length}`); }
      where.push('(' + ors.join(' or ') + ')');
    }
    const cond = where.length ? ' where ' + where.join(' and ') : '';
    const [{ n }] = await db.query('select count(*) as n from orders' + cond, params);
    const rows = await db.query(
      `select ${COLS} from orders${cond} order by created_at desc, id desc limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`, params);
    res.json({ orders: rows.map(adminOrder), total: Number(n), counts });
  });

  router.get('/orders/:code', async (req, res) => {
    const order = await detail(db, req.params.code);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    res.json({ order });
  });

  router.put('/orders/:code/status', async (req, res) => {
    const status = (req.body || {}).status;
    if (typeof status !== 'string' || !has(STATUSES, status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
    const out = await db.tx(async tx => {
      const [cur] = await tx.query('select id, status from orders where code = $1 for update', [req.params.code]);
      if (!cur) return null;
      if (cur.status !== status) {
        await tx.query('update orders set status = $1, updated_at = $2 where id = $3', [status, now(), cur.id]);
        await tx.query("insert into order_events (order_id, kind, actor_id, before, after, at) values ($1,'trang-thai',$2,$3,$4,$5)",
          [cur.id, req.user.id, JSON.stringify({ status: cur.status }), JSON.stringify({ status }), now()]);
      }
      return detail(tx, req.params.code);
    });
    if (!out) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    res.json({ order: out });
  });

  router.put('/orders/:code', async (req, res) => {
    const b = req.body || {};
    const next = {}; // chỉ các trường gửi lên
    let editInput = null;
    try {
      if (has(b, 'customer')) next.customer = parseCustomer(b.customer);
      if (has(b, 'payment')) next.payment = parsePayment(b.payment);
      if (has(b, 'internal_note')) {
        if (b.internal_note !== null && typeof b.internal_note !== 'string') throw new InputError('Ghi chú nội bộ không hợp lệ.');
        const note = (b.internal_note || '').trim();
        if (note.length > MAX_NOTE) throw new InputError('Ghi chú nội bộ tối đa ' + MAX_NOTE + ' ký tự.');
        next.internal_note = note || null;
      }
      if (has(b, 'lines')) editInput = b.lines;
      if (editInput !== null && !Array.isArray(editInput)) throw new InputError('Đơn phải có ít nhất một dòng.');
    } catch (e) {
      if (e instanceof InputError) return res.status(400).json({ error: e.message });
      throw e;
    }

    try {
      const out = await db.tx(async tx => {
        const [cur] = await tx.query(`select ${COLS} from orders where code = $1 for update`, [req.params.code]);
        if (!cur) return null;
        if (editInput) Object.assign(next, editLines(cur.lines, editInput));
        const before = {};
        const after = {};
        for (const k of Object.keys(next)) {
          const old = k === 'total' ? Number(cur.total) : cur[k];
          if (!same(old, next[k])) { before[k] = old; after[k] = next[k]; }
        }
        const keys = Object.keys(after);
        if (keys.length) {
          const sets = keys.map((k, i) => k + ' = $' + (i + 1));
          const vals = keys.map(k => (typeof after[k] === 'object' && after[k] !== null ? JSON.stringify(after[k]) : after[k]));
          await tx.query(`update orders set ${sets.join(', ')}, updated_at = $${keys.length + 1} where id = $${keys.length + 2}`, [...vals, now(), cur.id]);
          await tx.query("insert into order_events (order_id, kind, actor_id, before, after, at) values ($1,'sua',$2,$3,$4,$5)",
            [cur.id, req.user.id, JSON.stringify(before), JSON.stringify(after), now()]);
        }
        return detail(tx, req.params.code);
      });
      if (!out) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      res.json({ order: out });
    } catch (e) {
      if (e instanceof InputError) return res.status(400).json({ error: e.message });
      throw e;
    }
  });

  return router;
};
