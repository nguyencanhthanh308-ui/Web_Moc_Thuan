const express = require('express');
const cors = require('cors');
const { attachUser } = require('./auth');

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

function corsOptions(config) {
  const list = config.corsOrigins || [];
  const allowLocal = config.nodeEnv !== 'production' && !list.length;
  return {
    origin(origin, cb) {
      cb(null, !!origin && (list.includes(origin) || (allowLocal && LOCAL_ORIGIN.test(origin))));
    }
  };
}

function createApp({ db, storage, mailer, config, now = () => new Date() }) {
  const app = express();
  app.set('trust proxy', config.trustProxy || 1);
  app.locals.deps = { db, storage, mailer, config, now };
  if (config.nodeEnv === 'production') {
    // Ghi 3 yêu cầu đầu tiên đến từ bên ngoài (có x-forwarded-for) để chủ shop kiểm tra Render có chuyển đúng IP khách không.
    // Bỏ qua lần Render tự gọi /api/health trong mạng nội bộ (không có x-forwarded-for). Không ghi dữ liệu nào khác.
    let logged = 0;
    app.use((req, res, next) => {
      if (logged < 3 && req.headers['x-forwarded-for']) {
        logged++;
        console.log('[kiểm tra IP] req.ip=' + req.ip + ' | x-forwarded-for=' + (req.headers['x-forwarded-for'] || '(không có)'));
      }
      next();
    });
  }
  app.use(cors(corsOptions(config)));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (req, res) => {
    await db.query('select 1');
    res.json({ ok: true });
  });

  app.use(attachUser(db, now));
  app.use('/api/auth', require('./routes/auth')(app.locals.deps));
  app.use('/api/admin', require('./routes/products')(app.locals.deps));
  app.use('/api/admin', require('./routes/uploads')(app.locals.deps));
  app.use('/api/admin', require('./routes/admin-orders')(app.locals.deps));
  app.use('/api', require('./routes/orders')(app.locals.deps));
  // Router của các chức năng khác gắn ở đây: app.use('/api/xxx', require('./routes/xxx')(app.locals.deps));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy đường dẫn này.' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
    console.error(err);
    res.status(500).json({ error: 'Có lỗi xảy ra, vui lòng thử lại sau.' });
  });

  return app;
}

module.exports = { createApp };
