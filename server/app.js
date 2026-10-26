const express = require('express');
const cors = require('cors');

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
  app.set('trust proxy', 1);
  app.locals.deps = { db, storage, mailer, config, now };
  app.use(cors(corsOptions(config)));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (req, res) => {
    await db.query('select 1');
    res.json({ ok: true });
  });

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
