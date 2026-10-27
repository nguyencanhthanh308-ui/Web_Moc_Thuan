const REQUIRED = ['DATABASE_URL', 'SITE_URL', 'API_PUBLIC_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
  'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SHOP_EMAIL'];

function loadConfig(env) {
  const nodeEnv = env.NODE_ENV || 'development';
  if (nodeEnv !== 'test') {
    const missing = REQUIRED.filter(k => !env[k]);
    if (missing.length) throw new Error('Thiếu biến môi trường: ' + missing.join(', '));
  }
  return {
    nodeEnv,
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL || '',
    siteUrl: env.SITE_URL || '',
    apiPublicUrl: env.API_PUBLIC_URL || '',
    corsOrigins: (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    supabaseUrl: env.SUPABASE_URL || '',
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY || '',
    storageBucket: env.STORAGE_BUCKET || 'public-files',
    smtp: {
      host: env.SMTP_HOST || '',
      port: Number(env.SMTP_PORT) || 2525,
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.SMTP_FROM || env.SMTP_USER || ''
    },
    mailTimeoutMs: Number(env.MAIL_TIMEOUT_MS) || 8000,
    shopEmail: env.SHOP_EMAIL || ''
  };
}

module.exports = { loadConfig };
