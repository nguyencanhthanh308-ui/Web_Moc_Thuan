// Supabase Storage qua REST. Lỗi chỉ kèm mã HTTP và nội dung phản hồi, không bao giờ kèm khoá dịch vụ.
function createStorage({ supabaseUrl, serviceKey, bucket }) {
  const base = String(supabaseUrl).replace(/\/+$/, '');
  const encode = p => String(p).split('/').map(encodeURIComponent).join('/');
  const publicUrl = path => `${base}/storage/v1/object/public/${bucket}/${encode(path)}`;

  async function put(path, buffer, contentType, options = {}) {
    const headers = {
      Authorization: 'Bearer ' + serviceKey,
      apikey: serviceKey, // khóa kiểu mới sb_secret_... cần header này
      'Content-Type': contentType || 'application/octet-stream',
      'x-upsert': 'true'
    };
    if (options.cacheControl) headers['cache-control'] = options.cacheControl;
    const res = await fetch(`${base}/storage/v1/object/${bucket}/${encode(path)}`, { method: 'POST', headers, body: buffer, signal: AbortSignal.timeout(20000) });
    if (!res.ok) {
      let text = '';
      try { text = await res.text(); } catch (_) { /* bỏ qua */ }
      throw new Error(`Lưu file lên Storage thất bại (HTTP ${res.status}): ${text}`);
    }
    return publicUrl(path);
  }

  return { put, publicUrl };
}

module.exports = { createStorage };
