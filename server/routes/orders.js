const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { requireUser } = require('../auth');
const { STATUSES, MAX_ITEMS, InputError, str, parseCustomer, parsePayment, buildLines, nextOrderCode, newOrderEmail } = require('../services/orders');

const isUnique = e => e && (e.code === '23505' || /duplicate key|unique constraint/i.test(e.message || ''));

// Mã do trình duyệt tạo cho mỗi lần bấm gửi đơn, giữ nguyên khi gửi lại: cùng mã thì trả lại đơn đã có, không tạo đơn trùng
const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

const COLS = 'code, status, customer, payment, lines, total, note, created_at, updated_at';
const publicOrder = r => ({
  code: r.code, status: r.status, statusLabel: STATUSES[r.status] || r.status, customer: r.customer, payment: r.payment,
  lines: r.lines, total: Number(r.total), note: r.note, created_at: r.created_at, updated_at: r.updated_at
});

module.exports = function ordersRouter({ db, mailer, config, now }) {
  const router = express.Router();
  const createLimit = rateLimit({
    windowMs: 10 * 60 * 1000, limit: config.orderRateLimit || 5, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'Bạn gửi đơn quá nhiều lần, vui lòng thử lại sau ít phút hoặc gọi 0386 115 316 để đặt trực tiếp.' })
  });

  async function codeOfRequest(requestId) {
    if (!requestId) return null;
    const rows = await db.query('select code from orders where request_id = $1', [requestId]);
    return rows.length ? rows[0].code : null;
  }

  // Trùng mã đơn (hai khách gửi cùng lúc) thì lấy số kế tiếp, tối đa 5 lần.
  // Trùng request_id (trình duyệt gửi lại cùng lúc) thì trả {code của đơn đã có, existed: true}.
  async function insertOrder(order, userId, requestId) {
    for (let attempt = 1; ; attempt++) {
      const code = await nextOrderCode(db, now());
      try {
        await db.tx(async tx => {
          const [row] = await tx.query(
            `insert into orders (code, status, customer, payment, user_id, lines, total, note, request_id, created_at, updated_at)
             values ($1,'moi',$2,$3,$4,$5,$6,$7,$8,$9,$9) returning id`,
            [code, JSON.stringify(order.customer), order.payment, userId, JSON.stringify(order.lines), order.total, order.note, requestId, now()]);
          await tx.query(
            "insert into order_events (order_id, kind, actor_id, before, after, at) values ($1,'tao',$2,null,$3,$4)",
            [row.id, userId, JSON.stringify({ status: 'moi', total: order.total }), now()]);
        });
        return { code, existed: false };
      } catch (e) {
        if (!isUnique(e)) throw e;
        const existing = await codeOfRequest(requestId);
        if (existing) return { code: existing, existed: true };
        if (attempt >= 5) throw e;
      }
    }
  }

  router.post('/orders', createLimit, async (req, res) => {
    const b = req.body || {};
    if (typeof b.website === 'string' && b.website.trim()) {
      // ô bẫy cho robot: trả mã giả, không lưu
      return res.json({ code: 'DH' + String(now().getTime() % 1e6).padStart(6, '0') + '-001' });
    }
    const requestId = b.requestId == null ? null : b.requestId;
    if (requestId !== null && (typeof requestId !== 'string' || !REQUEST_ID.test(requestId))) {
      return res.status(400).json({ error: 'Mã gửi đơn không hợp lệ, vui lòng tải lại trang rồi gửi lại.' });
    }
    const already = await codeOfRequest(requestId);
    if (already) return res.status(201).json({ code: already });

    let customer, payment;
    try { customer = parseCustomer(b.customer); payment = parsePayment(b.payment); } catch (e) {
      if (e instanceof InputError) return res.status(400).json({ error: e.message });
      throw e;
    }
    if (!Array.isArray(b.items) || !b.items.length) return res.status(400).json({ error: 'Giỏ hàng đang trống.' });
    if (b.items.length > MAX_ITEMS) return res.status(400).json({ error: 'Mỗi đơn tối đa ' + MAX_ITEMS + ' món, vui lòng chia thành nhiều đơn.' });

    let built;
    try { built = await buildLines(db, b.items); } catch (e) {
      if (e instanceof InputError) return res.status(400).json({ error: e.message });
      throw e;
    }
    if (built.unavailable.length) {
      return res.status(422).json({ error: 'Có sản phẩm trong giỏ hiện không còn bán, vui lòng bỏ khỏi giỏ rồi gửi lại.', unavailable: built.unavailable });
    }

    const order = { customer, payment, note: str(b.note, 1000) || null, lines: built.lines, total: built.total };
    const { code, existed } = await insertOrder(order, req.user ? req.user.id : null, requestId);
    if (existed) return res.status(201).json({ code });

    // Đơn đã lưu xong mới gửi email; email lỗi không làm mất đơn
    if (config.shopEmail && mailer) {
      try {
        const mail = newOrderEmail({ ...order, code }, `${config.siteUrl}/admin.html#don=${code}`);
        await mailer.send({ to: config.shopEmail, ...mail });
      } catch (e) {
        console.error('Không gửi được email báo đơn mới ' + code, e);
      }
    }
    res.status(201).json({ code });
  });

  router.get('/me/orders', requireUser, async (req, res) => {
    const rows = await db.query(`select ${COLS} from orders where user_id = $1 order by created_at desc, id desc`, [req.user.id]);
    res.json({ orders: rows.map(publicOrder) });
  });

  router.get('/me/orders/:code', requireUser, async (req, res) => {
    const rows = await db.query(`select ${COLS} from orders where code = $1 and user_id = $2`, [req.params.code, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    res.json({ order: publicOrder(rows[0]) });
  });

  return router;
};
