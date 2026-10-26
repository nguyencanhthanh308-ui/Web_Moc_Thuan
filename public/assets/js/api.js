/* Mộc Thuận Nội Thất — gọi máy chủ API và giữ phiên đăng nhập
   Máy chủ chạy gói miễn phí nên có lúc đang ngủ: lời gọi đầu có thể mất 30–60 giây hoặc lỗi 502/503/504, nên cho thử lại. */
"use strict";

var TOKEN_KEY = 'mocthuan-token';
function tokenStore(v){
  try{
    if (v === undefined) return localStorage.getItem(TOKEN_KEY);
    if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY);
  }catch(e){ return null; }
}

var Api = {
  retryMs: 2000, /* lần thử lại thứ n chờ retryMs × 2^n: 2 s, 4 s, 8 s… */

  /* Trả Promise<json>. Lỗi: Error có .status (0 = không kết nối được) và .data (json lỗi của máy chủ) */
  call: function(method, path, body, opt){
    opt = opt || {};
    var retries = opt.retries || 0, slowMs = opt.slowMs == null ? 4000 : opt.slowMs;
    var slowTimer = opt.onSlow ? setTimeout(opt.onSlow, slowMs) : null;
    function fail(status, data, msg){ var e = new Error(msg); e.status = status; e.data = data || {}; return e; }
    function again(n){ return new Promise(function(r){ setTimeout(r, Api.retryMs * Math.pow(2, n)); }).then(function(){ return attempt(n + 1); }); }
    function attempt(n){
      var token = tokenStore(), headers = {}, form = typeof FormData !== 'undefined' && body instanceof FormData; /* FormData: tải tệp, trình duyệt tự đặt Content-Type */
      if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = 'Bearer ' + token;
      return fetch(MT_CONFIG.apiBase + path, {method:method, headers:headers, body: body === undefined || form ? body : JSON.stringify(body)}).then(function(res){
        if ((res.status === 502 || res.status === 503 || res.status === 504) && n < retries) return again(n);
        return res.text().then(function(txt){
          var data = {}; try{ data = txt ? JSON.parse(txt) : {}; }catch(e){}
          if (res.ok) return data;
          if (res.status === 401 && token) Auth._expired();
          throw fail(res.status, data, data.error || 'Máy chủ đang bận, vui lòng thử lại sau ít phút.');
        });
      }, function(){
        if (n < retries) return again(n);
        throw fail(0, null, 'Không kết nối được máy chủ, vui lòng thử lại sau ít phút.');
      });
    }
    return attempt(0).then(function(d){ clearTimeout(slowTimer); return d; }, function(e){ clearTimeout(slowTimer); throw e; });
  },

  /* đánh thức máy chủ ngay khi mở trang, không chờ kết quả */
  wake: function(){ try{ fetch(MT_CONFIG.apiBase + '/api/health').catch(function(){}); }catch(e){} }
};

/* Auth.user = {id, email, role, name, phone, address} hoặc null */
var Auth = {
  user: null,
  _fns: [],
  _ready: null,
  onChange: function(fn){ Auth._fns.push(fn); },
  _set: function(user){ Auth.user = user || null; Auth._fns.forEach(function(fn){ try{ fn(Auth.user); }catch(e){ setTimeout(function(){ throw e; }); } }); },
  _expired: function(){ tokenStore(null); if (Auth.user) Auth._set(null); },
  hasToken: function(){ return !!tokenStore(); },
  /* đọc lại người dùng từ token đã lưu; không có token thì null */
  load: function(){
    Auth._ready = !tokenStore() ? Promise.resolve(null) :
      Api.call('GET', '/api/auth/me', undefined, {retries:2}).then(function(d){ Auth._set(d.user); return Auth.user; }, function(){ return null; });
    return Auth._ready;
  },
  ready: function(){ return Auth._ready || Auth.load(); },
  _session: function(d){ tokenStore(d.token); Auth._set(d.user); return d.user; },
  login: function(email, password, opt){ return Api.call('POST', '/api/auth/login', {email:email, password:password}, Object.assign({retries:2}, opt)).then(Auth._session); },
  register: function(data, opt){ return Api.call('POST', '/api/auth/register', data, Object.assign({retries:2}, opt)).then(Auth._session); },
  update: function(data){ return Api.call('PUT', '/api/auth/me', data, {retries:2}).then(function(d){ Auth._set(d.user); return d.user; }); },
  /* báo máy chủ hủy phiên (lời gọi đã mang token) rồi xóa ngay ở trình duyệt, không chờ máy chủ */
  logout: function(){
    if (tokenStore()) Api.call('POST', '/api/auth/logout').catch(function(){});
    tokenStore(null); Auth._set(null);
  }
};
