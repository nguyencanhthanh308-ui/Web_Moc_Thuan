const { newDb } = require('pg-mem');
const { loadConfig } = require('../server/config');
const { createDb, migrate } = require('../server/db');
const { createApp } = require('../server/app');

class FakeStorage {
  constructor() { this.files = new Map(); }
  publicUrl(path) { return 'https://fake.storage/' + path; }
  async put(path, buffer, contentType) {
    this.files.set(path, { buffer, contentType });
    return this.publicUrl(path);
  }
}

class FakeMailer {
  constructor() { this.sent = []; this.fail = false; }
  async send(msg) {
    if (this.fail) throw new Error('Gửi email thất bại (giả lập)');
    this.sent.push(msg);
  }
}

// overrides: {config, now, storage, mailer}
async function newTestApp(overrides = {}) {
  const { Pool } = newDb().adapters.createPg();
  const db = createDb(new Pool());
  await migrate(db);
  const storage = overrides.storage || new FakeStorage();
  const mailer = overrides.mailer || new FakeMailer();
  const config = { ...loadConfig({ NODE_ENV: 'test' }), ...(overrides.config || {}) };
  const app = createApp({ db, storage, mailer, config, now: overrides.now });
  return { app, db, storage, mailer };
}

module.exports = { newTestApp, FakeStorage, FakeMailer };
