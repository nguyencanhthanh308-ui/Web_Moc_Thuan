/* Mộc Thuận Nội Thất — trang quản lý: đơn hàng, sản phẩm và giá (admin.html)
   Cần đăng nhập tài khoản quản trị (Auth trong api.js, token gửi bằng Authorization: Bearer).
   Sản phẩm tải từ GET /api/admin/products. Lưu, Xóa, đổi giá hàng loạt, hệ số chất liệu gửi ngay lên máy chủ;
   máy chủ ghi vào cơ sở dữ liệu rồi xuất lại catalog.js cho web. Ảnh và mô hình .glb tải lên qua /api/admin/uploads.
   Lỗi khi lưu thì báo rõ và giữ nguyên nội dung đang sửa để bấm Lưu lại. Tab Đơn hàng nằm trong admin-orders.js. */
"use strict";

var view = {tab:'orders', q:'', cat:'', status:'', sort:'code', shown:40};
var layerClose = null;
var signedIn = false, started = false, loaded = false, loadErr = '', busy = 0;
var SLOW_MSG = 'Máy chủ đang khởi động, có thể mất tới 1 phút…';

function clone(o){ return JSON.parse(JSON.stringify(o)); }
function P(){ return CATALOG.products; }
function rawById(id){ return P().filter(function(r){ return r.id === id; })[0]; }
function nextId(){ return P().reduce(function(m, r){ return Math.max(m, r.id); }, 1000) + 1; }
function freeCode(id){ var c = 'MA' + id; while (P().some(function(r){ return r.code === c; })) c += 'B'; return c; }
function maxOrder(){ return P().reduce(function(m, r){ return Math.max(m, +r.order || 0); }, 0); }
function num(s){ var n = parseInt(String(s).replace(/[^\d]/g, ''), 10); return isNaN(n) ? 0 : n; }
function money(n){ return n ? Math.round(n).toLocaleString('vi-VN') : ''; }
function sel(b){ return b ? ' selected' : ''; }
function opt(cur){ return function(o){ return '<option value="' + o[0] + '"' + sel(cur === o[0]) + '>' + esc(o[1]) + '</option>'; }; }
function kf(n){ return String(n).replace('.', ','); }
function suggestPrices(kind){ var k = K[kind]; return k.W.map(function(W){ return [W, Math.round((k.p + k.pcm * (W - k.W[0])) / 10000) * 10000]; }); }
function cardPrice(r){ var p = makeProduct(r); return p ? finalPrice(p, p.W, p.wood) : 0; }
function purgeThumbs(id){ Object.keys(Thumb.cache).forEach(function(k){ if (k.indexOf('p' + id + '|') === 0) delete Thumb.cache[k]; }); }
function hhmm(d){ return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }

function toast(msg, act, fn){
  var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  if (act){ var b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = act; b.onclick = function(){ fn(); t.remove(); }; t.appendChild(b); }
  document.body.appendChild(t); setTimeout(function(){ t.remove(); }, act ? 9000 : 2600);
}
function showLayer(html, onClose){
  $('#layer').innerHTML = '<div class="scrim" data-close></div>' + html;
  layerClose = onClose || closeLayer;
  $$('[data-close],[data-x]', $('#layer')).forEach(function(b){ b.onclick = function(){ layerClose(); }; });
  var f = $('#layer').querySelector('input,select,button:not([data-x])'); if (f) f.focus();
}
function closeLayer(){ $('#layer').innerHTML = ''; layerClose = null; }
function modal(html){ showLayer('<div class="modal" role="dialog" aria-modal="true">' + html + '</div>'); }
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && layerClose && !$('#layer').hidden) layerClose(); });

/* ================= GỌI MÁY CHỦ =================
   Chỉ GET và PUT (gửi lại cho cùng kết quả) được thử lại khi máy chủ đang ngủ; POST / DELETE thì không,
   vì máy chủ có thể đã làm xong (ví dụ đã đổi giá hàng loạt) rồi mới trả lỗi. */
function status(msg, warn){ var el = $('#status'); el.textContent = msg || ''; el.hidden = !msg; el.className = 'adm-status' + (warn ? ' warn' : ''); }
function saved(what){ status('Đã lưu ' + what + ' lúc ' + hhmm(new Date())); }
function api(method, path, body){
  busy++;
  var retries = method === 'GET' || method === 'PUT' ? 2 : 0;
  return Api.call(method, path, body, {retries:retries, onSlow:function(){ status(SLOW_MSG, true); }})
    .then(function(d){ busy--; return d; }, function(e){ busy--; throw e; });
}
/* 502 kèm câu báo của máy chủ: dữ liệu đã lưu vào hệ thống nhưng chưa xuất lại được catalog.js cho web */
function publishFail(e){ return e.status === 502 && !!(e.data && e.data.error); }
function errText(e){ return e.status === 401 ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm Lưu lần nữa.' : e.message; }
function upload(file, kind){
  var fd = new FormData(); fd.append('file', file);
  return api('POST', '/api/admin/uploads?kind=' + kind, fd).then(function(d){ return d.url; });
}
window.addEventListener('beforeunload', function(e){ if (busy){ e.preventDefault(); e.returnValue = ''; } });

/* ================= ĐĂNG NHẬP =================
   Hết phiên (401) thì chỉ ẩn trang và ngăn sửa rồi hiện form đăng nhập; đăng nhập lại thì mọi thứ đang sửa còn nguyên. */
function gate(on){
  $('.adm-tabs').hidden = !on; $('#adm').hidden = !on; $('#layer').hidden = !on;
  $('#who').hidden = $('#logoutBtn').hidden = !on;
  $('#who').textContent = on ? (Auth.user.name || Auth.user.email) : '';
  if (on) $('#gate').innerHTML = '';
}
function showLogin(msg){
  gate(false); status('');
  $('#gate').innerHTML = '<div class="auth-page adm-login"><div class="auth-card"><h1>Đăng nhập quản trị</h1>' +
    '<p class="muted">Dùng tài khoản quản trị của cửa hàng để xem đơn hàng và sửa sản phẩm.</p>' +
    '<form class="form" id="admLogin" novalidate>' +
      '<label for="a-email">Email<input id="a-email" type="email" required autocomplete="username"></label>' +
      '<label for="a-pass">Mật khẩu<input id="a-pass" type="password" required autocomplete="current-password"></label>' +
      '<p class="form-msg" role="status" hidden></p><button class="btn primary" type="submit">Đăng nhập</button></form></div></div>';
  var f = $('#admLogin'), m = f.querySelector('.form-msg'), b = f.querySelector('button');
  function say(t, err){ m.textContent = t || ''; m.className = 'form-msg' + (err ? ' err' : ''); m.hidden = !t; }
  say(msg, true);
  f.onsubmit = function(e){
    e.preventDefault();
    if (b.disabled) return;
    b.disabled = true; say('');
    Auth.login($('#a-email').value.trim(), $('#a-pass').value, {onSlow:function(){ say(SLOW_MSG); }}).then(function(u){
      b.disabled = false;
      if (u.role !== 'admin'){ Auth.logout(); say('Tài khoản này không có quyền quản trị.', true); return; }
      enter();
    }, function(err){ b.disabled = false; say(err.message, true); });
  };
  $('#a-email').focus();
}
function enter(){
  signedIn = true; gate(true);
  if (started) return;
  started = true; loaded = false; render(); loadProducts();
}
Auth.onChange(function(u){
  if (u || !signedIn) return;
  signedIn = false;
  showLogin('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại. Phần đang sửa vẫn được giữ.');
});
$('#logoutBtn').onclick = function(){
  if (layerClose){ layerClose(); if (layerClose) return; } // còn thay đổi chưa lưu và người dùng chọn ở lại
  signedIn = false; started = false; loaded = false; $('#adm').innerHTML = '';
  Auth.logout(); showLogin();
};

/* ================= DỮ LIỆU SẢN PHẨM ================= */
// luôn đủ mọi chất liệu: máy chủ chỉ giữ những chất liệu có trong lần lưu
function fullWoodK(k){ var o = {}; WOOD.forEach(function(w){ o[w.id] = k && k[w.id] > 0 ? k[w.id] : w.k; }); return o; }
function loadProducts(){
  loadErr = '';
  return api('GET', '/api/admin/products').then(function(d){
    CATALOG.products = d.products || [];
    CATALOG.woodK = fullWoodK(d.woodK);
    applyWoodK(CATALOG.woodK); Thumb.cache = {}; loaded = true; status('');
  }, function(e){ loadErr = e.status === 401 ? '' : e.message; status(''); }).then(function(){ if (signedIn && view.tab !== 'orders') render(); });
}

/* ================= TAB ================= */
function render(){
  $$('.adm-tabs [data-tab]').forEach(function(b){ b.setAttribute('aria-selected', b.getAttribute('data-tab') === view.tab); });
  if (view.tab === 'orders') return Orders.tab();
  if (!loaded){
    $('#adm').innerHTML = loadErr ? '<p class="form-msg err">' + esc(loadErr) + '</p><p><button class="btn sm" type="button" id="reloadBtn">Tải lại sản phẩm</button></p>'
      : '<p class="muted adm-count">Đang tải sản phẩm…</p>';
    var rb = $('#reloadBtn'); if (rb) rb.onclick = function(){ loadErr = ''; render(); loadProducts(); };
    return;
  }
  ({list:tabList, kinds:tabKinds, wood:tabWood})[view.tab]();
}
$('.adm-tabs').onclick = function(e){
  var b = e.target.closest('[data-tab]'); if (!b) return;
  view.tab = b.getAttribute('data-tab');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  render(); window.scrollTo(0, 0);
};
window.addEventListener('hashchange', function(){
  if (!signedIn) return;
  if (/^#don=/.test(location.hash)) view.tab = 'orders';
  if (view.tab === 'orders') render();
});

/* ---------- danh sách sản phẩm ---------- */
function filtered(){
  var words = fold(view.q).split(' ').filter(Boolean), s = view.status;
  var list = P().filter(function(r){
    var sub = SUBS[r.sub];
    if (view.cat && (!sub || sub.cat.id !== view.cat)) return false;
    if ((s === 'on' && r.hidden) || (s === 'off' && !r.hidden) || (s === 'sale' && !r.sale) || (s === 'new' && !r.isNew) || (s === 'nophoto' && r.photos && r.photos.length)) return false;
    if (words.length){ var t = fold(r.name + ' ' + r.code + ' ' + (sub ? sub.name : '')); if (!words.every(function(w){ return t.indexOf(w) >= 0; })) return false; }
    return true;
  });
  if (view.sort === 'recent') list.sort(function(a, b){ return b.id - a.id; });
  else if (view.sort === 'asc' || view.sort === 'desc'){
    var pr = {}; list.forEach(function(r){ pr[r.id] = cardPrice(r); });
    list.sort(function(a, b){ return view.sort === 'asc' ? pr[a.id] - pr[b.id] : pr[b.id] - pr[a.id]; });
  }
  else list.sort(function(a, b){ return a.code.localeCompare(b.code, 'vi', {numeric:true}); });
  return list;
}
function tabList(){
  $('#adm').innerHTML = '<div class="adm-toolbar">' +
    '<input type="search" id="fq" placeholder="Tìm theo tên hoặc mã" aria-label="Tìm sản phẩm" value="' + esc(view.q) + '">' +
    '<select id="fcat" aria-label="Lọc theo nhóm"><option value="">Tất cả nhóm</option>' + CATS.map(function(c){ return '<option value="' + c.id + '"' + sel(view.cat === c.id) + '>' + esc(c.name) + '</option>'; }).join('') + '</select>' +
    '<select id="fstatus" aria-label="Lọc theo trạng thái">' + [['','Mọi trạng thái'],['on','Đang bán'],['off','Ngừng bán'],['sale','Đang giảm giá'],['new','Mẫu mới'],['nophoto','Chưa có ảnh thật']].map(opt(view.status)).join('') + '</select>' +
    '<select id="fsort" aria-label="Sắp xếp">' + [['code','Theo mã'],['recent','Mới thêm trước'],['asc','Giá thấp đến cao'],['desc','Giá cao đến thấp']].map(opt(view.sort)).join('') + '</select>' +
    '<span class="grow"></span>' +
    '<button class="btn sm" id="bulkBtn" type="button">Đổi giá hàng loạt</button>' +
    '<button class="btn sm primary" id="addBtn" type="button">+ Thêm sản phẩm</button>' +
  '</div><div id="plist"></div>';
  $('#fq').oninput = function(){ view.q = this.value; view.shown = 40; drawList(); };
  $('#fcat').onchange = function(){ view.cat = this.value; view.shown = 40; drawList(); };
  $('#fstatus').onchange = function(){ view.status = this.value; view.shown = 40; drawList(); };
  $('#fsort').onchange = function(){ view.sort = this.value; drawList(); };
  $('#addBtn').onclick = function(){ openEditor(newRaw(), true); };
  $('#bulkBtn').onclick = openBulk;
  $('#plist').onclick = function(e){
    if (e.target.closest('#moreRows')){ view.shown += 40; drawList(); return; }
    var row = e.target.closest('[data-id]'); if (row) openEditor(clone(rawById(+row.getAttribute('data-id'))), false);
  };
  drawList();
}
function drawList(){
  var list = filtered();
  $('#plist').innerHTML = '<p class="muted adm-count">' + list.length + ' sản phẩm' + (list.length !== P().length ? ' (trong tổng ' + P().length + ')' : '') + '. Bấm vào một dòng để sửa.</p>' +
    (list.length ? '<div class="plist"><div class="prow head" aria-hidden="true"><span></span><span>Sản phẩm</span><span>Danh mục</span><span>Giá trên thẻ</span><span>Trạng thái</span></div>' +
      list.slice(0, view.shown).map(rowHTML).join('') + '</div>' +
      (list.length > view.shown ? '<div class="more"><button class="btn" type="button" id="moreRows">Xem thêm ' + Math.min(40, list.length - view.shown) + ' sản phẩm</button></div>' : '')
    : '<div class="empty">Không có sản phẩm khớp bộ lọc.</div>');
}
function rowHTML(r){
  var p = makeProduct(r), sub = SUBS[r.sub];
  var img = !p ? '' : (photoOf(p, 0) ? photoTag(photoOf(p, 0), '') : thumbImg(p, null, '') + '<span class="ph-tag">3D</span>');
  var pr = p ? finalPrice(p, p.W, p.wood) : 0, base = p ? priceOf(p, p.W, p.wood) : 0;
  var tags = (r.hidden ? '<span class="badge off">Ngừng bán</span>' : '<span class="badge on">Đang bán</span>') +
    (r.sale ? '<span class="badge sale">−' + r.sale + '%</span>' : '') + (r.isNew ? '<span class="badge">Mới</span>' : '') +
    (r.photos && r.photos.length ? '<span class="badge">Ảnh thật</span>' : '') + (r.model ? '<span class="badge">3D riêng</span>' : '') + (r.flag ? '<span class="badge">Nổi bật</span>' : '');
  return '<button class="prow" type="button" data-id="' + r.id + '"><span class="ph">' + img + '</span>' +
    '<span class="nm"><b>' + esc(r.name) + '</b><span class="mono">' + esc(r.code) + '</span></span>' +
    '<span class="ct">' + esc(sub ? sub.name : 'Danh mục không tồn tại') + '<small>' + esc(sub ? sub.cat.short : '') + '</small></span>' +
    '<span class="pr"><b>' + (pr ? vnd(pr) : '—') + '</b>' + (r.sale && base ? '<s>' + vnd(base) + '</s>' : '') + '</span>' +
    '<span class="tg">' + tags + '</span></button>';
}

/* ---------- đổi giá hàng loạt ---------- */
function openBulk(){
  var list = filtered();
  if (!list.length){ toast('Không có sản phẩm nào trong bộ lọc'); return; }
  modal('<h3>Đổi giá hàng loạt</h3><p>Áp dụng cho <b>' + list.length + ' sản phẩm</b> đang hiện theo bộ lọc. Mọi kích thước của từng sản phẩm đổi cùng một tỉ lệ, làm tròn đến 10.000 ₫.</p>' +
    '<div class="fld"><label for="bPct">Tăng hoặc giảm (%)</label><input id="bPct" type="number" step="0.5" value="5"><small>Nhập số âm để giảm giá gốc, ví dụ −5. Muốn chạy khuyến mãi thì dùng ô “Giảm giá (%)” của từng sản phẩm.</small></div>' +
    '<p class="note" id="bEx"></p><p class="err" id="bErr" role="alert"></p><div class="modal-acts"><button class="btn sm" type="button" data-x>Hủy</button><button class="btn sm primary" type="button" id="bGo">Áp dụng</button></div>');
  function scale(v, pct){ return Math.max(10000, Math.round(v * (1 + pct/100) / 10000) * 10000); }
  function ex(){
    var pct = parseFloat($('#bPct').value) || 0, r = list[0], x = r.prices[0];
    $('#bEx').textContent = 'Ví dụ ' + r.code + ', dài ' + x[0] + ' cm: ' + vnd(x[1]) + ' → ' + vnd(scale(x[1], pct));
  }
  $('#bPct').oninput = ex; ex();
  $('#bGo').onclick = function(){
    var b = this, pct = parseFloat($('#bPct').value) || 0; if (!pct){ closeLayer(); return; }
    if (b.disabled) return;
    b.disabled = true; $('#bErr').textContent = '';
    // máy chủ đổi giá theo đúng cách làm tròn của scale(); 502 là đã đổi nhưng web chưa cập nhật
    api('POST', '/api/admin/products/bulk-price', {ids:list.map(function(r){ return r.id; }), percent:pct}).then(function(){ done(''); }, function(e){
      if (publishFail(e)) return done(e.message);
      b.disabled = false; $('#bErr').textContent = errText(e);
    });
    function done(warn){
      list.forEach(function(r){ r.prices.forEach(function(x){ x[1] = scale(x[1], pct); }); });
      closeLayer(); drawList();
      if (warn) status(warn, true); else saved('giá ' + list.length + ' sản phẩm');
      toast('Đã đổi giá ' + list.length + ' sản phẩm (' + (pct > 0 ? '+' : '') + kf(pct) + '%)');
    }
  };
}

/* ================= SỬA / THÊM SẢN PHẨM ================= */
function newRaw(subId, kind){
  var sub = SUBS[subId] || (view.cat ? CATS.filter(function(c){ return c.id === view.cat; })[0].subs[0] : CATS[0].subs[0]);
  kind = kind || sub.kind;
  var k = K[kind], id = nextId();
  return {id:id, code:freeCode(id), sub:sub.id, kind:kind, style:k.styles[0], name:sub.name + ' ' + k.styles[0],
    prices:suggestPrices(kind), W:k.W[0], wood:'caosu', frame:'den', uph:'xam', sale:0, isNew:true, order:maxOrder() + 10, photos:[]};
}
function openEditor(r, isNew){
  // danh mục hoặc dáng đã bị đổi tên trong data.js: gắn tạm vào cái gần nhất để mở được, lưu lại là sửa xong
  if (!SUBS[r.sub]) r.sub = (CATS.map(function(c){ return c.subs; }).reduce(function(a, b){ return a.concat(b); }).filter(function(s){ return s.kind === r.kind; })[0] || CATS[0].subs[0]).id;
  if (!K[r.kind]) r.kind = SUBS[r.sub].kind;
  var ed = r, orig = JSON.stringify(r), mounted = false;
  showLayer('<aside class="drawer right ed" role="dialog" aria-modal="true" aria-labelledby="edTitle">' +
    '<div class="drawer-head"><h3 id="edTitle">' + (isNew ? 'Thêm sản phẩm mới' : 'Sửa sản phẩm <span class="mono">' + esc(r.code) + '</span>') + '</h3><button class="icon-btn" type="button" data-x aria-label="Đóng">✕</button></div>' +
    '<div class="drawer-body"><div class="ed-grid">' +
      '<div class="ed-left"><div class="viewer" id="edViewer"><span class="v-hint">Kéo để xoay · cuộn để phóng</span></div>' +
        '<div class="v-tools"><button class="btn sm" type="button" data-v="top">Nhìn từ trên</button><button class="btn sm" type="button" data-v="back">Mặt sau</button><button class="btn sm ghost" type="button" data-v="home">Về góc nhìn gốc</button></div>' +
        '<p class="note">Mô hình dựng theo kích thước và màu mặc định đang chọn. Khách sẽ xoay xem đúng mô hình này ở trang sản phẩm.</p></div>' +
      '<form class="ed-form" id="edForm" novalidate>' +
        '<section class="ed-sec" id="sInfo"></section><section class="ed-sec" id="s3d"></section><section class="ed-sec" id="sModel"></section><section class="ed-sec" id="sSize"></section>' +
        '<section class="ed-sec" id="sColor"></section><section class="ed-sec" id="sPhoto"></section></form>' +
    '</div></div>' +
    '<div class="drawer-foot ed-foot"><div class="l">' + (isNew || r.flag ? '' : '<button class="btn sm ghost danger" type="button" id="edDel">Xóa sản phẩm</button>') +
      (isNew ? '' : '<button class="btn sm ghost" type="button" id="edDup">Nhân bản</button>') + '</div>' +
      '<p class="err" id="edErr" role="alert"></p>' +
      '<div class="r"><button class="btn sm" type="button" data-x>Hủy</button><button class="btn sm primary" type="button" id="edSave">' + (isNew ? 'Thêm vào danh sách' : 'Lưu thay đổi') + '</button></div></div></aside>', tryClose);
  var F = $('#edForm');

  function dirty(){ return JSON.stringify(ed) !== orig; }
  function tryClose(){ if (dirty() && !confirm('Bỏ các thay đổi chưa lưu của sản phẩm này?')) return; stopPick(); closeLayer(); }
  function tmp(){
    var c = clone(ed); c.id = 'edit';
    c.prices = c.prices.filter(function(x){ return x[0] >= 5 && x[1] >= 0; });
    return makeProduct(c);
  }
  function preview(reset){
    var p = tmp(); if (!p) return;
    if (!mounted){ Viewer.mount($('#edViewer'), p, null); Viewer.dimOn = true; mounted = true; }
    else if (Viewer.el && Viewer.el.isConnected) Viewer.set(p, null, reset);
  }

  function secInfo(){
    $('#sInfo').innerHTML = '<h4>Thông tin</h4>' +
      '<div class="fld"><label for="fName">Tên sản phẩm</label><span class="with-btn"><input id="fName" value="' + esc(ed.name) + '" autocomplete="off"><button type="button" class="btn sm ghost" id="fAutoName">Đặt theo kiểu dáng</button></span></div>' +
      '<div class="row2"><div class="fld"><label for="fCode">Mã sản phẩm</label><input id="fCode" class="mono" value="' + esc(ed.code) + '" autocomplete="off"></div>' +
      '<div class="fld"><label for="fOrder">Thứ tự hiển thị</label><input id="fOrder" type="number" step="1" value="' + (+ed.order || 0) + '"></div></div>' +
      '<p class="note">Thứ tự: số nhỏ hiện trước khi khách xếp theo “Phổ biến”.</p>' +
      '<div class="fld"><label for="fSub">Danh mục trên web</label><select id="fSub">' + CATS.map(function(c){
        return '<optgroup label="' + esc(c.name) + '">' + c.subs.map(function(s){ return '<option value="' + s.id + '"' + sel(s.id === ed.sub) + '>' + esc(s.name) + '</option>'; }).join('') + '</optgroup>';
      }).join('') + '</select></div>' +
      '<div class="checks"><label><input type="checkbox" id="fOn"' + (ed.hidden ? '' : ' checked') + (ed.flag ? ' disabled' : '') + '>Đang bán. Bỏ chọn để ẩn khỏi web nhưng vẫn giữ trong danh sách.</label>' +
      '<label><input type="checkbox" id="fNew"' + (ed.isNew ? ' checked' : '') + '>Gắn nhãn “Mẫu mới”</label></div>' +
      (ed.flag ? '<p class="note">Đây là sản phẩm nổi bật ở đầu trang chủ nên không ẩn hoặc xóa được.</p>' : '');
  }
  function sec3d(){
    var sub = SUBS[ed.sub], k = K[ed.kind];
    var ids = Object.keys(K).filter(function(id){ return id !== sub.kind; }).sort(function(a, b){ return K[a].name.localeCompare(K[b].name, 'vi'); });
    $('#s3d').innerHTML = '<h4>Mô hình 3D</h4>' +
      '<p class="note">Không cần vẽ mô hình. Chọn dáng giống sản phẩm thật nhất rồi chọn kiểu dáng; mô hình bên cạnh tự dựng lại theo kích thước. Xem hình tất cả các dáng ở tab “Dáng 3D có sẵn”.</p>' +
      '<div class="fld"><label for="fKind">Dáng sản phẩm</label><select id="fKind">' + [sub.kind].concat(ids).map(function(id){
        return '<option value="' + id + '"' + sel(id === ed.kind) + '>' + esc(K[id].name) + (id === sub.kind ? ' (dáng của danh mục này)' : '') + '</option>';
      }).join('') + '</select></div>' +
      '<div class="fld"><span class="lbl" id="lStyle">Kiểu dáng</span><div class="chips" role="group" aria-labelledby="lStyle">' + k.styles.map(function(s){
        return '<button type="button" class="chip" data-style="' + esc(s) + '" aria-pressed="' + (s === ed.style) + '">' + esc(s) + '</button>';
      }).join('') + '</div></div>' +
      (k.gen === 'deskTray' ? '<p class="note">Bàn hộc dây có thiết kế đã chốt với xưởng (sâu ' + k.D + ', cao ' + k.H + ' cm), nên không đổi sâu và cao ở đây.</p>' :
      '<div class="row2"><div class="fld"><label for="fD">' + (k.gen === 'bed' ? 'Dài nệm (cm)' : 'Sâu (cm)') + '</label><input id="fD" type="number" min="5" step="1" placeholder="' + k.D + '" value="' + (ed.D || '') + '"></div>' +
      '<div class="fld"><label for="fH">Cao (cm)</label><input id="fH" type="number" min="1" step="0.5" placeholder="' + k.H + '" value="' + (ed.H || '') + '"></div></div>' +
      '<p class="note">Để trống thì dùng số mặc định của dáng: ' + (k.gen === 'bed' ? 'dài nệm ' : 'sâu ') + k.D + ' cm, cao ' + kf(k.H) + ' cm.</p>');
  }
  function secModel(){
    var m = ed.model, VIEWS = [['front','Mặt trước'],['side','Hai bên hông'],['top','Nhìn từ trên'],['back','Mặt sau']];
    var h = '<h4>Mô hình 3D riêng <span class="muted">(không bắt buộc)</span></h4>' +
      '<p class="note">Có mô hình làm từ app quét 3D (Polycam, RealityScan, Scaniverse…) hoặc phần mềm 3D (SketchUp, Blender) thì xuất file <b>.glb</b> rồi chọn ở đây, file được tải lên kho lưu trữ (tối đa 25 MB). Web sẽ dùng mô hình này thay cho dáng ở trên. Nên giữ file dưới 10 MB để trang tải nhanh.</p>';
    if (!m){
      $('#sModel').innerHTML = h + '<div class="ph-add"><button type="button" class="btn sm" id="mPick">Chọn file .glb…</button><input type="file" id="mFile" accept=".glb" hidden>' +
        '<input id="mPath" placeholder="hoặc dán đường dẫn file .glb" aria-label="Đường dẫn file mô hình"><button type="button" class="btn sm" id="mPathAdd">Dùng</button></div>';
      return;
    }
    $('#sModel').innerHTML = h +
      '<div class="model-file"><span class="mono">' + esc(m.src) + '</span><span class="acts"><button type="button" class="btn sm ghost" id="mPick">Đổi file…</button><input type="file" id="mFile" accept=".glb" hidden>' +
        '<button type="button" class="btn sm ghost danger" id="mDrop">Bỏ mô hình riêng</button></span></div>' +
      '<p class="note" id="mStat" aria-live="polite"></p>' +
      '<div class="row3"><div class="fld"><label for="mW">Dài thật (cm)</label><input id="mW" type="number" min="1" step="0.1" value="' + (m.W || '') + '"></div>' +
        '<div class="fld"><label for="mD">Sâu thật (cm)</label><input id="mD" type="number" min="1" step="0.1" placeholder="tự tính" value="' + (m.D || '') + '"></div>' +
        '<div class="fld"><label for="mH">Cao thật (cm)</label><input id="mH" type="number" min="1" step="0.1" placeholder="tự tính" value="' + (m.H || '') + '"></div></div>' +
      '<p class="note">Chỉ nhập dài thì mô hình co đều theo tỉ lệ. Nhập thêm sâu và cao thì co theo từng chiều cho khớp số đo thật.</p>' +
      '<div class="fld"><span class="lbl">Hướng đặt</span><span class="with-btn"><button type="button" class="btn sm" data-rot="1">Xoay ngang 90°</button><button type="button" class="btn sm" data-rot="0">Lật dựng 90°</button></span>' +
        '<small>Xoay đến khi mặt trước sản phẩm quay về phía bạn ở góc nhìn gốc và chân chạm sàn.</small></div>' +
      '<div class="fld"><span class="lbl">Kích thước chi tiết</span>' +
        '<p class="note">Bấm “Đo trên mô hình”, rồi bấm điểm đầu và điểm cuối trên mô hình 3D. Sửa chữ cho đúng số đo thật (ví dụ “để chân 90 cm”) và chọn góc nhìn: kích thước chỉ hiện khi khách xoay tới góc đó.</p>' +
        (m.dims.length ? '<div class="dm-list">' + m.dims.map(function(d, i){
          return '<div class="dm-row"><input class="dmT" data-i="' + i + '" value="' + esc(d.t) + '" aria-label="Chữ hiện cho kích thước ' + (i+1) + '">' +
            '<select class="dmV" data-i="' + i + '" aria-label="Góc nhìn của kích thước ' + (i+1) + '">' + VIEWS.map(opt(d.v)).join('') + '</select>' +
            '<button type="button" class="icon-btn sm" data-rmd="' + i + '" aria-label="Xóa kích thước ' + (i+1) + '">✕</button></div>';
        }).join('') + '</div>' : '') +
        '<span class="with-btn"><button type="button" class="btn sm" id="mMeasure" aria-pressed="false">Đo trên mô hình</button><span class="note" id="mHint" aria-live="polite"></span></span></div>';
  }
  function modelStat(){
    var el = $('#mStat'); if (!el || !ed.model) return;
    var st = Scan.state(ed.model.src), p = st === 'ok' ? tmp() : null, b = p ? scanBuild(p) : null;
    el.className = 'note' + (st === 'err' ? ' warn' : '');
    el.textContent = st === 'err' ? 'Không tải được file. Kiểm tra lại đường dẫn, hoặc bấm “Đổi file…” chọn lại.'
      : b ? 'Mô hình đang hiện: dài ' + fcm(b.info.W) + ' × sâu ' + fcm(b.info.D) + ' × cao ' + fcm(b.info.H) + ' cm. So lại với số đo thật.'
      : 'Đang tải mô hình…';
  }
  function loadModel(){ if (!ed.model) return; Scan.load(ed.model.src, function(){ modelStat(); preview(true); }); modelStat(); }
  function setModel(src){
    src = src.trim().replace(/\\/g, '/'); if (!src) return;
    if (ed.model) ed.model.src = src; else ed.model = {src:src, W:ed.W, rot:[0, 0], dims:[]};
    stopPick(); secModel(); loadModel();
  }

  // đo trên mô hình: bấm (không kéo) hai điểm trên mô hình riêng
  var pick = null, marker = null, down = null, VE = $('#edViewer');
  function stopPick(){
    pick = null; if (marker && marker.parent) marker.parent.remove(marker); marker = null; VE.classList.remove('picking');
    var b = $('#mMeasure'); if (b){ b.textContent = 'Đo trên mô hình'; b.setAttribute('aria-pressed', 'false'); }
  }
  VE.addEventListener('pointerdown', function(e){ down = [e.clientX, e.clientY]; });
  VE.addEventListener('pointerup', function(e){
    if (!pick || !down || Math.abs(e.clientX - down[0]) + Math.abs(e.clientY - down[1]) > 6 || !Viewer.info || !Viewer.info.scan) return;
    var rect = Viewer.r.domElement.getBoundingClientRect(), rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((e.clientX - rect.left)/rect.width*2 - 1, -(e.clientY - rect.top)/rect.height*2 + 1), Viewer.cam);
    var hit = rc.intersectObject(Viewer.model, true).filter(function(x){ return x.object !== marker; })[0], I = Viewer.info, W = I.W/10, D = I.D/10, H = I.H/10;
    if (!hit){ $('#mHint').textContent = 'Chưa trúng mô hình, bấm lại.'; return; }
    if (!pick.length){
      pick.push(hit.point.clone());
      marker = new THREE.Mesh(new THREE.SphereGeometry(Math.max(W, D, H)*.012, 12, 8), new THREE.MeshBasicMaterial({color:new THREE.Color(cssVar('--sale')), depthTest:false}));
      marker.renderOrder = 12; marker.position.copy(hit.point); Viewer.model.add(marker);
      $('#mHint').textContent = 'Bấm điểm cuối.'; return;
    }
    var a = pick[0], b = hit.point, d = Viewer.cam.position.clone().sub(Viewer.target).normalize();
    function n(q){ return [+((q.x + W/2)/W).toFixed(4), +(q.y/H).toFixed(4), +((q.z + D/2)/D).toFixed(4)]; }
    ed.model.dims.push({a:n(a), b:n(b), t:fcm(a.distanceTo(b)*10) + ' cm', v:d.y > .75 ? 'top' : Math.abs(d.x) > Math.abs(d.z) ? 'side' : d.z > 0 ? 'front' : 'back'});
    stopPick(); secModel(); modelStat(); preview(false);
    var inp = $$('.dmT', F).pop(); inp.focus(); inp.select();
  });

  function secSize(){
    $('#sSize').innerHTML = '<h4>Kích thước &amp; giá</h4>' +
      '<p class="note">Nhập giá bán với chất liệu hệ số 1 (gỗ cao su); chất liệu khác tự nhân theo tab “Hệ số chất liệu”. Khách đặt kích thước riêng thì web ước tính giá theo bảng này.' + (isNew ? ' <b>Giá đang điền sẵn là giá gợi ý theo dáng, hãy sửa thành giá thật.</b>' : '') + '</p>' +
      '<div class="sz"><div class="sz-row head" aria-hidden="true"><span>Mặc định</span><span>Dài (cm)</span><span>Giá (₫)</span><span></span></div>' +
      ed.prices.map(function(x, i){
        return '<div class="sz-row"><input type="radio" name="fDef" value="' + i + '"' + (x[0] === ed.W ? ' checked' : '') + ' aria-label="Dùng ' + x[0] + ' cm làm kích thước mặc định">' +
          '<input class="szW mono" type="number" min="5" step="1" data-i="' + i + '" value="' + x[0] + '" aria-label="Chiều dài dòng ' + (i+1) + ' (cm)">' +
          '<input class="szP mono" inputmode="numeric" data-i="' + i + '" value="' + money(x[1]) + '" aria-label="Giá dòng ' + (i+1) + ' (đồng)">' +
          '<button type="button" class="icon-btn sm" data-rm="' + i + '" aria-label="Xóa kích thước dòng ' + (i+1) + '"' + (ed.prices.length < 2 ? ' disabled' : '') + '>✕</button>' +
          '<span class="szD note" data-d="' + i + '"></span></div>';
      }).join('') + '</div>' +
      '<button type="button" class="btn sm" id="fAddSize">+ Thêm kích thước</button>' +
      '<div class="row2"><div class="fld"><label for="fSale">Giảm giá (%)</label><input id="fSale" type="number" min="0" max="90" step="1" value="' + (+ed.sale || 0) + '"></div></div>' +
      '<div class="ed-sum" id="edSum" aria-live="polite"></div>';
    updateSum();
  }
  function updateSum(){
    var p = tmp();
    $$('[data-d]', F).forEach(function(s){ var w = ed.prices[+s.getAttribute('data-d')][0]; s.textContent = p && w >= 5 ? 'Trên web: ' + dimsText(p, w) : ''; });
    if (!p){ $('#edSum').textContent = 'Chưa có kích thước hợp lệ.'; return; }
    var pr = finalPrice(p, p.W, p.wood), base = priceOf(p, p.W, p.wood), w = p.k.parts.indexOf('w') >= 0 ? byId(WOOD, p.wood) : null;
    $('#edSum').innerHTML = 'Thẻ sản phẩm trên web hiện <b>' + vnd(pr) + '</b>' + (p.sale ? ' <s>' + vnd(base) + '</s>' : '') +
      '<span class="note">' + esc(dimsText(p, p.W)) + (w ? ' · ' + esc(w.name) + ' hệ số ' + kf(w.k) : '') + (p.sale ? ' · giảm ' + p.sale + '%' : '') + '</span>';
  }
  function secColor(){
    var k = K[ed.kind], h = '<h4>Màu mặc định</h4><p class="note">Màu hiện trên thẻ sản phẩm và khi khách mới mở trang. Khách vẫn chọn được màu khác.</p>';
    function sw(title, part, list){
      return '<div class="fld"><span class="lbl" id="l-' + part + '">' + esc(title) + ': <b data-cur="' + part + '">' + esc(byId(list, ed[part]).name) + '</b></span><div class="swatches" role="group" aria-labelledby="l-' + part + '">' +
        list.map(function(m){ return '<button type="button" class="sw" data-part="' + part + '" data-id="' + m.id + '" title="' + esc(m.name) + '" aria-label="' + esc(m.name) + '" aria-pressed="' + (m.id === ed[part]) + '" style="background:' + m.c + '"></button>'; }).join('') + '</div></div>';
    }
    if (k.parts.indexOf('w') >= 0) h += sw('Chất liệu mặt', 'wood', WOOD);
    if (k.parts.indexOf('f') >= 0) h += sw(k.frameLabel || 'Màu khung', 'frame', FRAME);
    if (k.parts.indexOf('u') >= 0) h += sw('Màu bọc', 'uph', UPH);
    $('#sColor').innerHTML = h;
  }
  function secPhoto(){
    $('#sPhoto').innerHTML = '<h4>Ảnh thực tế</h4>' +
      '<p class="note">Chọn ảnh JPG, PNG hoặc WEBP trong máy (tối đa 8 MB mỗi ảnh), ảnh được tải lên kho lưu trữ. Ảnh đầu tiên là ảnh đại diện. Chưa có ảnh thì web dùng ảnh dựng 3D và ghi rõ “Ảnh dựng 3D”.</p>' +
      (ed.photos.length ? '<ul class="ph-list">' + ed.photos.map(function(u, i){
        return '<li><span class="ph"><img src="' + esc(u) + '" alt=""><span class="miss" hidden>Chưa thấy file</span></span><span class="mono">' + esc(u) + '</span>' +
          '<span class="acts">' + (i ? '<button type="button" class="btn sm ghost" data-up="' + i + '">Làm ảnh đại diện</button>' : '<span class="badge">Ảnh đại diện</span>') +
          '<button type="button" class="icon-btn sm" data-rmph="' + i + '" aria-label="Bỏ ảnh ' + esc(u) + '">✕</button></span></li>';
      }).join('') + '</ul>' : '<p class="empty sm">Chưa có ảnh thực tế.</p>') +
      '<div class="ph-add"><button type="button" class="btn sm" id="fPick">Chọn ảnh trong máy…</button><input type="file" id="fFiles" accept="image/jpeg,image/png,image/webp" multiple hidden>' +
      '<input id="fPath" placeholder="hoặc dán đường dẫn ảnh" aria-label="Đường dẫn ảnh"><button type="button" class="btn sm" id="fPathAdd">Thêm</button></div>';
    $$('.ph-list img', F).forEach(function(im){ im.onerror = function(){ im.hidden = true; im.nextElementSibling.hidden = false; }; });
  }
  function addPhoto(u){ u = u.trim().replace(/\\/g, '/'); if (u && ed.photos.indexOf(u) < 0) ed.photos.push(u); }
  // tải ảnh / mô hình lên máy chủ; trả URL, hoặc '' nếu lỗi (đã báo) hoặc ngăn sửa đã đóng
  var uploading = 0;
  function send(file, kind){
    uploading++; toast('Đang tải ' + file.name + ' lên…');
    return upload(file, kind).then(function(url){ uploading--; return F.isConnected ? url : ''; },
      function(e){ uploading--; toast('Không tải được ' + file.name + ': ' + errText(e)); return ''; });
  }

  F.addEventListener('input', function(e){
    var t = e.target, i = +t.getAttribute('data-i');
    if (t.id === 'fName') ed.name = t.value;
    else if (t.id === 'fCode') ed.code = t.value;
    else if (t.id === 'fOrder') ed.order = +t.value || 0;
    else if (t.id === 'fSale'){ ed.sale = Math.max(0, Math.min(90, +t.value || 0)); updateSum(); }
    else if (t.id === 'fD' || t.id === 'fH'){ var key = t.id.slice(1), v = parseFloat(t.value); if (v > 0) ed[key] = v; else delete ed[key]; preview(false); updateSum(); }
    else if (t.classList.contains('szW')){ var nw = Math.round(+t.value) || 0; if (ed.W === ed.prices[i][0]) ed.W = nw; ed.prices[i][0] = nw; preview(false); updateSum(); }
    else if (t.classList.contains('szP')){ ed.prices[i][1] = num(t.value); updateSum(); }
    else if (t.id === 'mW' || t.id === 'mD' || t.id === 'mH'){ var mk = t.id.slice(1), mv = parseFloat(t.value); if (mv > 0) ed.model[mk] = mv; else delete ed.model[mk]; preview(false); modelStat(); }
    else if (t.classList.contains('dmT')) ed.model.dims[i].t = t.value;
  });
  F.addEventListener('change', function(e){
    var t = e.target;
    if (t.classList.contains('szP')) t.value = money(num(t.value));
    else if (t.classList.contains('dmT')) preview(false);
    else if (t.classList.contains('dmV')){ ed.model.dims[+t.getAttribute('data-i')].v = t.value; preview(false); }
    else if (t.id === 'mFile' && t.files[0]){
      var mf = t.files[0]; t.value = '';
      send(mf, 'model').then(function(url){ if (url){ Scan.forget(url); setModel(url); } });
    }
    else if (t.name === 'fDef'){ ed.W = ed.prices[+t.value][0]; preview(false); updateSum(); }
    else if (t.id === 'fOn') ed.hidden = !t.checked;
    else if (t.id === 'fNew') ed.isNew = t.checked;
    else if (t.id === 'fSub'){
      var oldSub = SUBS[ed.sub], ns = SUBS[t.value]; ed.sub = t.value;
      // đổi danh mục: nếu sản phẩm đang dùng dáng mặc định của danh mục cũ thì chuyển theo dáng của danh mục mới
      if (ed.kind === oldSub.kind && ns.kind !== ed.kind) setKind(ns.kind); else sec3d();
    }
    else if (t.id === 'fKind') setKind(t.value);
    else if (t.id === 'fFiles'){
      // tải lần lượt để ảnh giữ đúng thứ tự đã chọn
      Array.prototype.slice.call(t.files).reduce(function(prev, f){
        return prev.then(function(){ return send(f, 'photo').then(function(url){ if (url){ addPhoto(url); secPhoto(); } }); });
      }, Promise.resolve());
      t.value = '';
    }
  });
  function setKind(kind){
    var k = K[kind]; ed.kind = kind; ed.style = k.styles[0]; delete ed.D; delete ed.H;
    if (isNew){ ed.prices = suggestPrices(kind); ed.W = k.W[0]; }
    sec3d(); secSize(); secColor(); preview(true);
  }
  F.addEventListener('click', function(e){
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-style')){ ed.style = b.getAttribute('data-style'); $$('[data-style]', F).forEach(function(x){ x.setAttribute('aria-pressed', x === b); }); preview(false); updateSum(); }
    else if (b.hasAttribute('data-part')){
      var part = b.getAttribute('data-part'); ed[part] = b.getAttribute('data-id');
      $$('[data-part="' + part + '"]', F).forEach(function(x){ x.setAttribute('aria-pressed', x === b); });
      $('[data-cur="' + part + '"]', F).textContent = b.getAttribute('title'); preview(false); updateSum();
    }
    else if (b.id === 'fAutoName'){ ed.name = SUBS[ed.sub].name + ' ' + ed.style; $('#fName').value = ed.name; }
    else if (b.id === 'fAddSize'){ var last = ed.prices[ed.prices.length - 1]; ed.prices.push([last[0] + 20, last[1]]); secSize(); F.querySelector('.sz-row:last-child .szW').focus(); }
    else if (b.hasAttribute('data-rm')){ var i = +b.getAttribute('data-rm'), gone = ed.prices.splice(i, 1)[0]; if (gone[0] === ed.W) ed.W = ed.prices[0][0]; secSize(); preview(false); }
    else if (b.id === 'fPick') $('#fFiles').click();
    else if (b.id === 'mPick') $('#mFile').click();
    else if (b.id === 'mPathAdd'){ Scan.forget($('#mPath').value.trim()); setModel($('#mPath').value); }
    else if (b.id === 'mDrop'){ stopPick(); delete ed.model; secModel(); preview(true); }
    else if (b.hasAttribute('data-rot')){
      if (ed.model.dims.length){ if (!confirm('Xoay mô hình sẽ làm lệch các kích thước đã đo. Xóa các kích thước đó để đo lại?')) return; ed.model.dims = []; }
      var ri = +b.getAttribute('data-rot'); ed.model.rot[ri] = ((ed.model.rot[ri] || 0) + 1) % 4; stopPick(); secModel(); loadModel(); preview(true);
    }
    else if (b.hasAttribute('data-rmd')){ ed.model.dims.splice(+b.getAttribute('data-rmd'), 1); secModel(); modelStat(); preview(false); }
    else if (b.id === 'mMeasure'){
      if (pick){ stopPick(); $('#mHint').textContent = ''; return; }
      if (!Viewer.info || !Viewer.info.scan){ $('#mHint').textContent = 'Mô hình riêng chưa tải xong.'; return; }
      pick = []; VE.classList.add('picking'); b.textContent = 'Hủy đo'; b.setAttribute('aria-pressed', 'true'); $('#mHint').textContent = 'Bấm điểm đầu trên mô hình.';
    }
    else if (b.id === 'fPathAdd'){ addPhoto($('#fPath').value); secPhoto(); }
    else if (b.hasAttribute('data-up')){ var u = ed.photos.splice(+b.getAttribute('data-up'), 1)[0]; ed.photos.unshift(u); secPhoto(); }
    else if (b.hasAttribute('data-rmph')){ ed.photos.splice(+b.getAttribute('data-rmph'), 1); secPhoto(); }
  });
  F.addEventListener('keydown', function(e){
    if (e.key !== 'Enter') return;
    if (e.target.id === 'fPath'){ e.preventDefault(); addPhoto(e.target.value); secPhoto(); }
    else if (e.target.id === 'mPath'){ e.preventDefault(); Scan.forget(e.target.value.trim()); setModel(e.target.value); }
  });
  F.addEventListener('submit', function(e){ e.preventDefault(); });
  $$('[data-v]', $('#layer')).forEach(function(b){ b.onclick = function(){ Viewer.view(b.getAttribute('data-v')); }; });

  function validate(){
    var errs = [], seen = {};
    ed.name = ed.name.trim(); ed.code = ed.code.trim();
    if (!ed.name) errs.push('Chưa nhập tên sản phẩm.');
    if (!ed.code) errs.push('Chưa nhập mã sản phẩm.');
    else if (P().some(function(x){ return x.id !== ed.id && x.code.toLowerCase() === ed.code.toLowerCase(); })) errs.push('Mã ' + ed.code + ' đã có ở sản phẩm khác.');
    ed.prices.forEach(function(x){
      if (!(x[0] >= 5)) errs.push('Chiều dài phải từ 5 cm trở lên.');
      else if (seen[x[0]]) errs.push('Kích thước ' + x[0] + ' cm bị nhập hai lần.');
      if (!(x[1] > 0)) errs.push('Còn kích thước chưa có giá.');
      seen[x[0]] = 1;
    });
    if (ed.model){
      if (!(ed.model.W > 0)) errs.push('Nhập dài thật của mô hình riêng.');
      ed.model.dims = ed.model.dims.filter(function(d){ d.t = d.t.trim(); return d.t; });
    }
    return errs.filter(function(m, i){ return errs.indexOf(m) === i; });
  }
  // lỗi thì ngăn sửa vẫn mở, nội dung giữ nguyên để bấm Lưu lại; warn = đã lưu nhưng web chưa cập nhật
  function edMsg(t, warn){ var el = $('#edErr'); el.textContent = t; el.classList.toggle('warn', !!warn); }
  function keep(r){ var i = P().indexOf(rawById(r.id)); if (i >= 0) P()[i] = r; else P().push(r); purgeThumbs(r.id); }
  var saveBtn = $('#edSave');
  saveBtn.onclick = function(){
    if (saveBtn.disabled) return;
    if (uploading){ edMsg('Đang tải tệp lên, chờ xong rồi bấm Lưu.'); return; }
    var errs = validate();
    if (errs.length){ edMsg(errs.join(' ')); return; }
    ed.prices.sort(function(a, b){ return a[0] - b[0]; });
    if (!ed.prices.some(function(x){ return x[0] === ed.W; })) ed.W = ed.prices[0][0];
    if (!ed.hidden) delete ed.hidden;
    var sent = clone(ed), code = ed.code;
    saveBtn.disabled = true; edMsg(''); status('Đang lưu ' + code + '…');
    api('PUT', '/api/admin/products/' + ed.id, {product:sent}).then(function(d){
      keep(d.product || sent); saved(code); closeLayer();
      if (view.tab === 'list') drawList(); else { view.tab = 'list'; render(); }
      toast((isNew ? 'Đã thêm ' : 'Đã lưu ') + code);
    }, function(e){
      saveBtn.disabled = false;
      if (publishFail(e)){ keep(sent); orig = JSON.stringify(ed); if (view.tab === 'list') drawList(); edMsg(e.message, true); status(e.message, true); return; }
      edMsg(errText(e)); status('Chưa lưu được ' + code, true);
    });
  };
  var del = $('#edDel');
  if (del) del.onclick = function(){
    if (del.disabled || !confirm('Xóa “' + ed.name + '” (' + ed.code + ') khỏi danh sách?\nMuốn tạm ngừng bán thì bỏ chọn “Đang bán” thay vì xóa.')) return;
    var id = ed.id, code = ed.code;
    function gone(warn){
      var r = rawById(id); if (r) P().splice(P().indexOf(r), 1);
      closeLayer(); if (view.tab === 'list') drawList();
      if (warn) status(warn, true); else saved('xóa ' + code);
      toast('Đã xóa ' + code);
    }
    del.disabled = true; edMsg('');
    api('DELETE', '/api/admin/products/' + id).then(function(){ gone(''); }, function(e){
      if (publishFail(e)) return gone(e.message);
      del.disabled = false; edMsg(errText(e));
    });
  };
  var dup = $('#edDup');
  if (dup) dup.onclick = function(){
    if (dirty() && !confirm('Nhân bản sẽ bỏ các thay đổi chưa lưu của sản phẩm này. Tiếp tục?')) return;
    var c = clone(JSON.parse(orig)), id = nextId();
    c.id = id; c.code = freeCode(id); c.name += ' (bản sao)'; c.order = maxOrder() + 10; delete c.flag;
    closeLayer(); openEditor(c, true);
  };

  secInfo(); sec3d(); secModel(); secSize(); secColor(); secPhoto();
  preview(true); loadModel();
  $('#layer [data-x]').focus();
}

/* ---------- dáng 3D có sẵn ---------- */
function tabKinds(){
  var used = {};
  CATS.forEach(function(c){ c.subs.forEach(function(s){ (used[s.kind] = used[s.kind] || []).push(s); }); });
  $('#adm').innerHTML = '<div class="adm-intro"><h2>Dáng 3D có sẵn</h2>' +
    '<p>Thêm sản phẩm mới không cần vẽ 3D: chọn một dáng dưới đây và một kiểu dáng, mô hình tự dựng theo chiều dài, sâu, cao và màu bạn nhập.</p>' +
    '<p>Nếu sản phẩm thật không giống dáng nào (ví dụ giường tầng, bàn chữ L), hãy chọn dáng gần nhất và gắn ảnh thực tế; thẻ sản phẩm sẽ dùng ảnh thật. Muốn có dáng mới thì cần lập trình thêm một bộ dựng trong <span class="mono">model3d.js</span>.</p></div>' +
    '<div class="kind-grid">' + Object.keys(K).map(function(id){
      var k = K[id], subs = used[id] || [], sub = subs[0] || CATS[0].subs[0];
      var p = makeProduct({id:'k-' + id, code:'', sub:sub.id, kind:id, style:k.styles[0], name:k.name, prices:[[k.W[0], k.p]], W:k.W[0], wood:'soi', frame:'den', uph:'xam'});
      return '<div class="kind"><div class="ph">' + thumbImg(p, null, k.name) + '</div><div class="t"><b>' + esc(k.name) + '</b>' +
        '<span class="note">Kiểu: ' + esc(k.styles.join(' · ')) + '</span>' +
        '<span class="note">Mặc định: dài ' + k.W.join(', ') + ' cm · sâu ' + k.D + ' · cao ' + kf(k.H) + ' cm</span>' +
        (subs.length ? '<span class="note">Đang dùng ở: ' + esc(subs.map(function(s){ return s.name; }).join(', ')) + '</span>' : '') +
        '<button class="btn sm" type="button" data-kind="' + id + '" data-sub="' + sub.id + '">+ Dùng dáng này</button></div></div>';
    }).join('') + '</div>';
  $('#adm').querySelector('.kind-grid').onclick = function(e){
    var b = e.target.closest('[data-kind]'); if (b) openEditor(newRaw(b.getAttribute('data-sub'), b.getAttribute('data-kind')), true);
  };
}

/* ---------- hệ số chất liệu ---------- */
function tabWood(){
  $('#adm').innerHTML = '<div class="adm-intro"><h2>Hệ số giá theo chất liệu</h2>' +
    '<p>Giá trong bảng kích thước của mỗi sản phẩm là giá với hệ số 1. Khi khách chọn chất liệu khác, web nhân giá với hệ số của chất liệu đó rồi làm tròn đến 10.000 ₫. Chỉ áp dụng cho sản phẩm có phần “Chất liệu mặt”.</p></div>' +
    '<div class="wood-list">' + WOOD.map(function(w){
      return '<div class="wood-row"><span class="sw" style="background:' + w.c + '" aria-hidden="true"></span><label for="wk-' + w.id + '">' + esc(w.name) + '</label>' +
        '<input id="wk-' + w.id + '" class="mono" data-w="' + w.id + '" type="number" min="0.5" max="3" step="0.01" value="' + esc(CATALOG.woodK[w.id]) + '"><span class="note" data-ex="' + w.id + '"></span></div>';
    }).join('') + '</div>' +
    '<div class="help-acts"><button class="btn sm primary" type="button" id="woodSave">Lưu hệ số chất liệu</button></div><p class="form-msg err" id="woodErr" role="alert" hidden></p>';
  function ex(){ WOOD.forEach(function(w){ $('[data-ex="' + w.id + '"]').textContent = 'Bàn giá gốc 2.000.000 ₫ → ' + vnd(Math.round(2000000 * w.k / 10000) * 10000); }); }
  $('#adm').querySelector('.wood-list').oninput = function(e){
    var id = e.target.getAttribute('data-w'), v = parseFloat(e.target.value); if (!id) return;
    if (v >= .5 && v <= 3){ CATALOG.woodK[id] = v; applyWoodK(CATALOG.woodK); ex(); status('Hệ số chất liệu chưa lưu', true); }
  };
  // luôn gửi đủ mọi chất liệu (xem fullWoodK)
  $('#woodSave').onclick = function(){
    var b = this, er = $('#woodErr'); if (b.disabled) return;
    b.disabled = true; er.hidden = true; status('Đang lưu hệ số chất liệu…');
    api('PUT', '/api/admin/settings/woodK', {woodK:fullWoodK(CATALOG.woodK)}).then(function(){ b.disabled = false; saved('hệ số chất liệu'); }, function(e){
      b.disabled = false;
      if (publishFail(e)){ status(e.message, true); return; }
      status('Chưa lưu được hệ số chất liệu', true); er.textContent = errText(e); er.hidden = false;
    });
  };
  ex();
}

/* ================= KHỞI ĐỘNG ================= */
Api.wake();
if (/^#don=/.test(location.hash)) view.tab = 'orders';
gate(false);
if (!Auth.hasToken()) showLogin();
else {
  $('#gate').innerHTML = '<p class="muted adm-count">Đang kết nối máy chủ…</p>';
  Auth.load().then(function(u){
    if (u && u.role === 'admin') return enter();
    if (u){ Auth.logout(); return showLogin('Tài khoản này không có quyền quản trị.'); }
    showLogin(Auth.hasToken() ? 'Chưa kết nối được máy chủ, vui lòng thử lại sau ít phút.' : '');
  });
}
