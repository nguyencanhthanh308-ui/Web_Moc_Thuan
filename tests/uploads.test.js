const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { newTestApp, tokenFor } = require('./helpers');

const bearer = t => ({ Authorization: 'Bearer ' + t });
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
const GLB = Buffer.concat([Buffer.from('glTF'), Buffer.alloc(100)]);
const upload = (app, token, kind, buf, filename, contentType) => {
  const r = request(app).post('/api/admin/uploads' + (kind ? '?kind=' + kind : ''));
  if (token) r.set(bearer(token));
  return buf ? r.attach('file', buf, { filename, contentType }) : r;
};

async function setup() {
  const t = await newTestApp();
  t.token = await tokenFor(t.db, 'admin');
  return t;
}

test('ảnh hợp lệ: 200, URL công khai, tên được làm sạch và lưu trong products/', async () => {
  const { app, storage, token } = await setup();
  const r = await upload(app, token, 'photo', JPEG, 'Bàn Đẹp  Số 1.JPG', 'image/jpeg');
  assert.equal(r.status, 200);
  const path = r.body.url.replace('https://fake.storage/', '');
  assert.match(path, /^products\/ban-dep-so-1-[a-z0-9]{6}\.jpg$/);
  assert.equal(storage.files.get(path).contentType, 'image/jpeg');
  assert.ok(storage.files.get(path).buffer.equals(JPEG));
});

test('hai lần tải cùng tên không ghi đè nhau', async () => {
  const { app, token } = await setup();
  const a = await upload(app, token, 'photo', JPEG, 'a.jpg', 'image/jpeg');
  const b = await upload(app, token, 'photo', JPEG, 'a.jpg', 'image/jpeg');
  assert.notEqual(a.body.url, b.body.url);
});

test('tên toàn ký tự lạ: dùng "file" làm tên gốc', async () => {
  const { app, token } = await setup();
  const r = await upload(app, token, 'photo', JPEG, '***.jpg', 'image/jpeg');
  assert.match(r.body.url, /\/products\/file-[a-z0-9]{6}\.jpg$/);
});

test('mô hình .glb hợp lệ: 200, lưu trong models/ với model/gltf-binary', async () => {
  const { app, storage, token } = await setup();
  const r = await upload(app, token, 'model', GLB, 'Ghế Gỗ.glb', 'application/octet-stream');
  assert.equal(r.status, 200);
  const path = r.body.url.replace('https://fake.storage/', '');
  assert.match(path, /^models\/ghe-go-[a-z0-9]{6}\.glb$/);
  assert.equal(storage.files.get(path).contentType, 'model/gltf-binary');
});

test('file .exe: 415', async () => {
  const { app, token, storage } = await setup();
  const r = await upload(app, token, 'photo', Buffer.from('MZ....'), 'virus.exe', 'application/x-msdownload');
  assert.equal(r.status, 415);
  assert.ok(r.body.error);
  assert.equal(storage.files.size, 0);
  assert.equal((await upload(app, token, 'model', Buffer.from('MZ....'), 'virus.exe', 'application/octet-stream')).status, 415);
});

test('tên .jpg nhưng nội dung không phải ảnh: 415; .glb sai đầu file: 415', async () => {
  const { app, token } = await setup();
  assert.equal((await upload(app, token, 'photo', Buffer.from('<script>alert(1)</script>'), 'a.jpg', 'image/jpeg')).status, 415);
  assert.equal((await upload(app, token, 'model', Buffer.from('not a glb'), 'a.glb', 'model/gltf-binary')).status, 415);
});

test('ảnh 9 MB: 413; mô hình 9 MB vẫn được', async () => {
  const { app, token } = await setup();
  const big = Buffer.concat([JPEG, Buffer.alloc(9 * 1024 * 1024)]);
  const r = await upload(app, token, 'photo', big, 'to.jpg', 'image/jpeg');
  assert.equal(r.status, 413);
  assert.ok(r.body.error);
  const bigGlb = Buffer.concat([GLB, Buffer.alloc(9 * 1024 * 1024)]);
  assert.equal((await upload(app, token, 'model', bigGlb, 'to.glb', 'model/gltf-binary')).status, 200);
});

test('mô hình quá 25 MB: 413', async () => {
  const { app, token } = await setup();
  const huge = Buffer.concat([GLB, Buffer.alloc(26 * 1024 * 1024)]);
  assert.equal((await upload(app, token, 'model', huge, 'to.glb', 'model/gltf-binary')).status, 413);
});

test('thiếu file hoặc kind sai: 400', async () => {
  const { app, token } = await setup();
  assert.equal((await upload(app, token, 'photo', null)).status, 400);
  assert.equal((await upload(app, token, 'khac', JPEG, 'a.jpg', 'image/jpeg')).status, 400);
  assert.equal((await upload(app, token, null, JPEG, 'a.jpg', 'image/jpeg')).status, 400);
});

test('chưa đăng nhập 401, token khách 403', async () => {
  const { app, db } = await setup();
  assert.equal((await upload(app, null, 'photo', JPEG, 'a.jpg', 'image/jpeg')).status, 401);
  const khach = await tokenFor(db, 'customer');
  assert.equal((await upload(app, khach, 'photo', JPEG, 'a.jpg', 'image/jpeg')).status, 403);
});

test('Storage lỗi: 502 tiếng Việt, không lộ chi tiết lỗi', async () => {
  const { app, token, storage } = await setup();
  storage.put = async () => { throw new Error('KHOA-BI-MAT'); };
  const r = await upload(app, token, 'photo', JPEG, 'a.jpg', 'image/jpeg');
  assert.equal(r.status, 502);
  assert.ok(r.body.error);
  assert.ok(!JSON.stringify(r.body).includes('KHOA-BI-MAT'));
});
