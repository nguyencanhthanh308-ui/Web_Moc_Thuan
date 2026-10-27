/* Mộc Thuận Nội Thất — nút tài khoản ở đầu trang, đăng nhập / đăng ký / quên mật khẩu, Đơn của tôi, Thông tin tài khoản
   Các trang: #dang-nhap, #dang-ky, #quen-mat-khau, #dat-lai-mat-khau=<token>, #don-cua-toi, #don=<mã>, #tai-khoan */
"use strict";

var SHOP_TEL = '<a href="tel:0386115316">0386 115 316</a>';
var PAY_LABEL = {'chuyen-khoan':'Chuyển khoản', 'khi-nhan':'Trả khi nhận hàng'};
var AUTH_PAGE = /^(dang-nhap|dang-ky|quen-mat-khau|dat-lai-mat-khau)/, USER_PAGE = /^(don-cua-toi|don=|tai-khoan)/;
var SLOW_MSG = 'Máy chủ đang khởi động, có thể mất tới 1 phút…';

function curHash(){ return (location.hash || '').slice(1); }
function decodeHash(s){ try{ return decodeURIComponent(s); }catch(e){ return s; } }
function fmtDate(s){ var d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}); }
function setMsg(el, html, kind){ el.className = 'form-msg' + (kind ? ' ' + kind : ''); el.innerHTML = html; el.hidden = !html; }

/* form có nút submit và ô .form-msg: khóa nút khi đang gửi, hiện lỗi máy chủ trả về */
function bindForm(form, work){
  var btn = form.querySelector('button[type=submit]'), msg = form.querySelector('.form-msg');
  form.onsubmit = function(e){
    e.preventDefault();
    if (btn.disabled) return;
    btn.disabled = true; setMsg(msg, '');
    work(function(){ setMsg(msg, esc(SLOW_MSG)); }, msg).then(function(){ btn.disabled = false; }, function(err){
      btn.disabled = false;
      setMsg(msg, esc(err.message) + (err.status === 0 ? ' Hoặc gọi ' + SHOP_TEL + '.' : ''), 'err');
    });
  };
}

function authPage(title, inner){
  $('#app').innerHTML = crumbs([[title]]) + '<div class="wrap auth-page"><div class="auth-card">' + inner + '</div></div>';
  document.title = title + ' · Mộc Thuận';
}
function field(id, label, attrs, val){ return '<label for="' + id + '">' + label + '<input id="' + id + '" ' + attrs + (val ? ' value="' + esc(val) + '"' : '') + '></label>'; }

/* ================= NÚT TÀI KHOẢN Ở ĐẦU TRANG ================= */
function acctHeader(){
  var box = $('#acct'), u = Auth.user;
  if (!u){ box.innerHTML = '<a class="btn sm acct-btn" href="#dang-nhap">Đăng nhập</a>'; return; }
  box.innerHTML = '<button class="btn sm acct-btn" id="acctBtn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="acctMenu"><span class="acct-name">' + esc(u.name || u.email) + '</span><span aria-hidden="true">▾</span></button>' +
    '<div class="acct-menu" id="acctMenu" hidden><div class="who">' + esc(u.email) + '</div>' +
    '<a href="#don-cua-toi">Đơn của tôi</a><a href="#tai-khoan">Thông tin tài khoản</a>' + (u.role === 'admin' ? '<a href="admin.html">Quản trị</a>' : '') +
    '<button type="button" id="logoutBtn">Đăng xuất</button></div>';
  var btn = $('#acctBtn'), menu = $('#acctMenu');
  btn.onclick = function(){ acctMenu(menu.hidden); };
  menu.onclick = function(e){ if (e.target.closest('a')) acctMenu(false); };
  $('#logoutBtn').onclick = function(){ acctMenu(false); Auth.logout(); toast('Đã đăng xuất.'); };
}
function acctMenu(open){
  var btn = $('#acctBtn'), menu = $('#acctMenu'); if (!menu) return;
  menu.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}
document.addEventListener('click', function(e){ if (!e.target.closest('#acct')) acctMenu(false); });
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') acctMenu(false); });

/* ================= ĐĂNG NHẬP, ĐĂNG KÝ, QUÊN / ĐẶT LẠI MẬT KHẨU ================= */
var authBack = 'home'; /* trang khách đang xem trước khi vào trang đăng nhập */
window.addEventListener('hashchange', function(e){ var old = (e.oldURL || '').split('#')[1] || ''; if (!AUTH_PAGE.test(old)) authBack = old || 'home'; });
function goBack(){ location.hash = authBack; }

/* reason: hiện khi trang cần đăng nhập (ví dụ Đơn của tôi); khi đó đăng nhập xong ở lại trang này */
function pageLogin(reason){
  if (Auth.user && !reason) return authPage('Đăng nhập', '<h1>Đăng nhập</h1><p>Bạn đang đăng nhập bằng <b>' + esc(Auth.user.email) + '</b>.</p><p><a class="btn" href="#don-cua-toi">Đơn của tôi</a></p>');
  authPage('Đăng nhập','<h1>Đăng nhập</h1>' + (reason ? '<p class="muted">' + esc(reason) + '</p>' : '<p class="muted">Đăng nhập để tự điền thông tin giao hàng và xem lại các đơn đã đặt. Không đăng nhập vẫn đặt hàng được.</p>') +
    '<form class="form" id="loginForm">' + field('l-email', 'Email', 'type="email" required autocomplete="email"') + field('l-pass', 'Mật khẩu', 'type="password" required autocomplete="current-password"') +
    '<p class="form-msg" role="status" hidden></p><button class="btn primary" type="submit">Đăng nhập</button></form>' +
    '<p class="auth-links"><a href="#quen-mat-khau">Quên mật khẩu?</a><span>Chưa có tài khoản? <a href="#dang-ky">Đăng ký</a></span></p>');
  bindForm($('#loginForm'), function(onSlow){
    return Auth.login($('#l-email').value.trim(), $('#l-pass').value, {onSlow:onSlow}).then(function(u){ toast('Xin chào ' + u.name); if (!reason) goBack(); });
  });
}
function pageRegister(){
  authPage('Đăng ký', '<h1>Tạo tài khoản</h1><p class="muted">Tài khoản giúp bạn xem lại đơn đã đặt và không phải nhập lại địa chỉ.</p>' +
    '<form class="form" id="registerForm">' + field('r-name', 'Họ tên', 'required autocomplete="name"') + field('r-email', 'Email', 'type="email" required autocomplete="email"') +
    field('r-pass', 'Mật khẩu (ít nhất 8 ký tự)', 'type="password" required minlength="8" autocomplete="new-password"') +
    field('r-phone', 'Số điện thoại (không bắt buộc)', 'inputmode="tel" autocomplete="tel"') +
    '<label for="r-addr">Địa chỉ giao hàng (không bắt buộc)<textarea id="r-addr" autocomplete="street-address"></textarea></label>' +
    '<p class="form-msg" role="status" hidden></p><button class="btn primary" type="submit">Đăng ký</button></form>' +
    '<p class="auth-links"><span>Đã có tài khoản? <a href="#dang-nhap">Đăng nhập</a></span></p>');
  bindForm($('#registerForm'), function(onSlow){
    return Auth.register({name:$('#r-name').value.trim(), email:$('#r-email').value.trim(), password:$('#r-pass').value, phone:$('#r-phone').value.trim(), address:$('#r-addr').value.trim()}, {onSlow:onSlow})
      .then(function(u){ toast('Đã tạo tài khoản. Xin chào ' + u.name); goBack(); });
  });
}
function pageForgot(){
  authPage('Quên mật khẩu', '<h1>Quên mật khẩu</h1><p class="muted">Nhập email đã đăng ký, cửa hàng sẽ gửi liên kết đặt lại mật khẩu (có hiệu lực 1 giờ).</p>' +
    '<form class="form" id="forgotForm">' + field('f-email', 'Email', 'type="email" required autocomplete="email"') +
    '<p class="form-msg" role="status" hidden></p><button class="btn primary" type="submit">Gửi liên kết</button></form><p class="auth-links"><a href="#dang-nhap">Quay lại đăng nhập</a></p>');
  bindForm($('#forgotForm'), function(onSlow, msg){
    return Api.call('POST', '/api/auth/forgot', {email:$('#f-email').value.trim()}, {retries:2, onSlow:onSlow}).then(function(){
      setMsg(msg, 'Nếu email này đã đăng ký, cửa hàng đã gửi liên kết đặt lại mật khẩu. Vui lòng xem hộp thư (cả mục Spam).', 'ok');
    });
  });
}
function pageReset(token){
  authPage('Đặt lại mật khẩu', '<h1>Đặt mật khẩu mới</h1>' +
    '<form class="form" id="resetForm">' + field('n-pass', 'Mật khẩu mới (ít nhất 8 ký tự)', 'type="password" required minlength="8" autocomplete="new-password"') +
    field('n-pass2', 'Nhập lại mật khẩu mới', 'type="password" required minlength="8" autocomplete="new-password"') +
    '<p class="form-msg" role="status" hidden></p><button class="btn primary" type="submit">Lưu mật khẩu mới</button></form>');
  bindForm($('#resetForm'), function(onSlow){
    if ($('#n-pass').value !== $('#n-pass2').value) return Promise.reject(new Error('Hai lần nhập mật khẩu chưa giống nhau.'));
    return Api.call('POST', '/api/auth/reset', {token:token, password:$('#n-pass').value}, {retries:2, onSlow:onSlow}).then(function(){
      $('.auth-card').innerHTML = '<h1>Đã đặt mật khẩu mới</h1><p>Vui lòng đăng nhập lại bằng mật khẩu mới.</p><p><a class="btn primary" href="#dang-nhap">Đăng nhập</a></p>';
    });
  });
}

/* ================= TRANG CẦN ĐĂNG NHẬP ================= */
/* render chạy khi đã có Auth.user; chưa có thì mời đăng nhập; có token mà máy chủ chưa trả lời thì chờ */
function withUser(reason, render){
  var h = curHash();
  if (Auth.user) return render();
  if (!Auth.hasToken()) return pageLogin(reason);
  authPage('Tài khoản', '<p class="muted">Đang tải thông tin tài khoản…</p>');
  Auth.ready().then(function(){
    if (curHash() !== h) return;
    if (Auth.user) return render();
    if (!Auth.hasToken()) return pageLogin(reason);
    authPage('Tài khoản', '<p class="form-msg err">Chưa kết nối được máy chủ. Vui lòng thử lại sau ít phút hoặc gọi ' + SHOP_TEL + '.</p><button class="btn" id="retryBtn" type="button">Thử lại</button>');
    $('#retryBtn').onclick = function(){ Auth.load(); route(); };
  });
}
function userPage(title, crumbList, inner){
  $('#app').innerHTML = crumbs(crumbList) + '<div class="wrap user-page">' + inner + '</div>';
  document.title = title + ' · Mộc Thuận';
}
/* tải dữ liệu cho trang đang xem; khách đã sang trang khác thì bỏ qua kết quả */
function loadInto(path, done){
  var h = curHash(), box = $('#userBody');
  Api.call('GET', path, undefined, {retries:3, onSlow:function(){ if (curHash() === h && box.isConnected) box.innerHTML = '<p class="muted">' + esc(SLOW_MSG) + '</p>'; }}).then(function(d){
    if (curHash() === h && box.isConnected) done(d, box);
  }, function(err){
    if (curHash() !== h || !box.isConnected) return;
    box.innerHTML = '<p class="form-msg err">' + esc(err.message) + (err.status === 0 || err.status >= 500 ? ' Hoặc gọi ' + SHOP_TEL + '.' : '') + '</p>';
  });
}

function statusTag(o){ return '<span class="status st-' + esc(o.status) + '">' + esc(o.statusLabel || o.status) + '</span>'; }
function orderHref(code){ return '#don=' + esc(encodeURIComponent(code)); }

function pageOrders(){
  userPage('Đơn của tôi', [['Đơn của tôi']], '<h1>Đơn của tôi</h1><div id="userBody"><p class="muted">Đang tải đơn hàng…</p></div>');
  loadInto('/api/me/orders', function(d, box){
    var list = d.orders || [];
    if (!list.length){ box.innerHTML = '<div class="empty">Bạn chưa có đơn nào khi đăng nhập bằng tài khoản này.<br>Đơn gửi khi chưa đăng nhập không hiện ở đây; cần hỏi thì gọi ' + SHOP_TEL + '.</div>'; return; }
    box.innerHTML = '<div class="orders">' + list.map(function(o){
      var n = (o.lines || []).filter(function(l){ return l.kind !== 'extra'; }).reduce(function(s, l){ return s + l.qty; }, 0);
      return '<a class="order-row" href="' + orderHref(o.code) + '"><span class="code mono">' + esc(o.code) + '</span>' + statusTag(o) +
        '<span class="muted">' + esc(fmtDate(o.created_at)) + ' · ' + esc(n) + ' sản phẩm</span><b class="amt">' + esc(vnd(o.total)) + '</b></a>';
    }).join('') + '</div>';
  });
}

function lineHTML(l){
  if (l.kind === 'extra'){
    var neg = l.amount < 0;
    return '<div class="ol"><div><b>' + esc(l.label) + '</b><div class="o">' + (neg ? 'Giảm giá' : 'Phụ phí') + '</div></div><div class="amt">' + esc((neg ? '−' : '') + vnd(Math.abs(l.amount))) + '</div></div>';
  }
  var mats = [l.woodName, l.frameName, l.uphName].filter(Boolean).join(' · ');
  return '<div class="ol"><div><b>' + esc(l.name) + '</b>' +
    '<div class="o">Mã <span class="mono">' + esc(l.code) + '</span> · ' + esc(l.W + ' × ' + l.D + ' × ' + l.H + ' cm') + (l.custom ? ' (kích thước riêng)' : '') + '</div>' +
    (mats ? '<div class="o">' + esc(mats) + '</div>' : '') +
    '<div class="o">' + esc(l.qty + ' × ' + vnd(l.unitPrice)) + (l.estimate ? ' <span class="est">giá tạm tính</span>' : '') + '</div></div>' +
    '<div class="amt">' + esc(vnd(l.unitPrice * l.qty)) + '</div></div>';
}
function pageOrder(code){
  userPage('Đơn ' + code, [['Đơn của tôi', '#don-cua-toi'], [code]], '<h1>Đơn <span class="mono">' + esc(code) + '</span></h1><div id="userBody"><p class="muted">Đang tải đơn hàng…</p></div>');
  loadInto('/api/me/orders/' + encodeURIComponent(code), function(d, box){
    var o = d.order, c = o.customer || {}, lines = o.lines || [];
    var est = lines.some(function(l){ return l.estimate; });
    box.innerHTML = '<div class="order-meta">' + statusTag(o) + '<span class="muted">Đặt lúc ' + esc(fmtDate(o.created_at)) + '</span></div>' +
      '<div class="order-grid"><section class="auth-card"><h2>Sản phẩm</h2>' + lines.map(lineHTML).join('') +
        '<div class="total"><span>Tổng cộng</span><b>' + esc(vnd(o.total)) + '</b></div>' +
        (est ? '<p class="note">Dòng ghi “giá tạm tính” là kích thước riêng, cửa hàng báo giá chính xác khi gọi lại xác nhận.</p>' : '') + '</section>' +
      '<section class="auth-card"><h2>Giao hàng</h2><dl class="kv"><dt>Người nhận</dt><dd>' + esc(c.name || '') + '</dd><dt>Điện thoại</dt><dd>' + esc(c.phone || '') + '</dd>' +
        '<dt>Địa chỉ</dt><dd>' + esc(c.address || '') + '</dd><dt>Thanh toán</dt><dd>' + esc(PAY_LABEL[o.payment] || o.payment || '') + '</dd>' +
        (o.note ? '<dt>Ghi chú</dt><dd>' + esc(o.note) + '</dd>' : '') + '</dl>' +
        '<p class="note">Cần đổi hoặc hủy đơn, vui lòng gọi ' + SHOP_TEL + '.</p></section></div>' +
      '<p><a class="btn sm" href="#don-cua-toi">← Tất cả đơn của tôi</a></p>';
  });
}

function pageProfile(){
  var u = Auth.user;
  userPage('Thông tin tài khoản', [['Thông tin tài khoản']], '<div class="auth-page"><div class="auth-card"><h1>Thông tin tài khoản</h1><p class="muted">Email: <b>' + esc(u.email) + '</b></p>' +
    '<form class="form" id="profileForm">' + field('p-name', 'Họ tên', 'required autocomplete="name"', u.name) + field('p-phone', 'Số điện thoại', 'inputmode="tel" autocomplete="tel"', u.phone) +
    '<label for="p-addr">Địa chỉ giao hàng<textarea id="p-addr" autocomplete="street-address">' + esc(u.address || '') + '</textarea></label>' +
    '<p class="form-msg" role="status" hidden></p><button class="btn primary" type="submit">Lưu thông tin</button></form>' +
    '<p class="note">Thông tin này được tự điền khi bạn đặt hàng. Muốn đổi mật khẩu, dùng <a href="#quen-mat-khau">Quên mật khẩu</a>.</p></div></div>');
  bindForm($('#profileForm'), function(onSlow, msg){
    return Auth.update({name:$('#p-name').value.trim(), phone:$('#p-phone').value.trim(), address:$('#p-addr').value.trim()}).then(function(){ setMsg(msg, 'Đã lưu thông tin.', 'ok'); });
  });
}

/* ================= GẮN VÀO app.js ================= */
var Account = {
  init: function(){
    acctHeader();
    Auth.onChange(function(){ acctHeader(); if (USER_PAGE.test(curHash())) route(); });
    Auth.load();
  },
  /* trả true nếu h là trang của tài khoản */
  route: function(h){
    if (h === 'dang-nhap') pageLogin();
    else if (h === 'dang-ky') pageRegister();
    else if (h === 'quen-mat-khau') pageForgot();
    else if (h.indexOf('dat-lai-mat-khau=') === 0) pageReset(decodeHash(h.slice(17)));
    else if (h === 'don-cua-toi') withUser('Vui lòng đăng nhập để xem các đơn đã đặt.', pageOrders);
    else if (h.indexOf('don=') === 0) withUser('Vui lòng đăng nhập để xem đơn hàng.', function(){ pageOrder(decodeHash(h.slice(4))); });
    else if (h === 'tai-khoan') withUser('Vui lòng đăng nhập để xem thông tin tài khoản.', pageProfile);
    else return false;
    return true;
  }
};
