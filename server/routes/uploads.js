const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { requireAdmin } = require('../auth');

const MB = 1024 * 1024;
const PHOTO_MAX = 8 * MB;
const MODEL_MAX = 25 * MB;
const PHOTO_TYPES = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const startsWith = (buf, bytes) => buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);
const MAGIC = {
  jpeg: buf => startsWith(buf, [0xff, 0xd8, 0xff]),
  png: buf => startsWith(buf, [0x89, 0x50, 0x4e, 0x47]),
  webp: buf => buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP'
};

// Bỏ dấu, chữ thường, chỉ giữ [a-z0-9._-], thêm 6 ký tự ngẫu nhiên trước đuôi để không ghi đè
function cleanName(original) {
  const flat = String(original || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const dot = flat.lastIndexOf('.');
  const clean = s => s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const ext = dot > 0 ? '.' + clean(flat.slice(dot + 1)) : '';
  const base = clean(dot > 0 ? flat.slice(0, dot) : flat) || 'file';
  const rand = Array.from(crypto.randomBytes(6), b => ALPHABET[b % ALPHABET.length]).join('');
  return base + '-' + rand + (ext === '.' ? '' : ext);
}

module.exports = function uploadsRouter({ storage }) {
  const router = express.Router();
  const parse = multer({ storage: multer.memoryStorage(), limits: { fileSize: MODEL_MAX, files: 1 } }).single('file');

  router.post('/uploads', requireAdmin, (req, res, next) => {
    parse(req, res, err => {
      if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Tệp quá lớn.' });
      if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Dữ liệu tải lên không hợp lệ.' });
      next(err);
    });
  }, async (req, res) => {
    const kind = req.query.kind;
    if (kind !== 'photo' && kind !== 'model') return res.status(400).json({ error: 'Loại tệp phải là photo hoặc model.' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Chưa chọn tệp để tải lên.' });
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8'); // busboy đọc tên tệp theo latin1
    const name = cleanName(original);
    let path, contentType;
    if (kind === 'photo') {
      const type = PHOTO_TYPES[file.mimetype];
      if (!type || !MAGIC[type](file.buffer)) return res.status(415).json({ error: 'Ảnh phải là tệp JPG, PNG hoặc WEBP.' });
      if (file.size > PHOTO_MAX) return res.status(413).json({ error: 'Ảnh quá lớn, tối đa 8 MB.' });
      path = 'products/' + name;
      contentType = file.mimetype;
    } else {
      if (!/\.glb$/i.test(file.originalname) || file.buffer.toString('latin1', 0, 4) !== 'glTF') return res.status(415).json({ error: 'Mô hình phải là tệp .glb.' });
      path = 'models/' + name;
      contentType = 'model/gltf-binary';
    }
    try {
      res.json({ url: await storage.put(path, file.buffer, contentType) });
    } catch (e) {
      console.error('Không tải được tệp lên Storage', e.message);
      res.status(502).json({ error: 'Không lưu được tệp lên kho lưu trữ, vui lòng thử lại.' });
    }
  });

  return router;
};
