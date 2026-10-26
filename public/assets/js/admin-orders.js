/* Mộc Thuận Nội Thất — tab Đơn hàng của trang quản lý (admin.html)
   Danh sách: lọc theo trạng thái, tìm theo mã đơn, tên hoặc số điện thoại (GET /api/admin/orders).
   #don=<mã>: chi tiết đơn — đổi trạng thái (gợi ý bước tiếp theo; hủy hoặc mở lại đơn Hoàn tất phải xác nhận),
   sửa đơn giá / số lượng / bỏ dòng, thêm phụ phí hoặc giảm giá, sửa thông tin khách, cách trả tiền, ghi chú nội bộ, xem lịch sử.
   Dòng sản phẩm gửi lên dạng {ref: vị trí dòng trong đơn đang lưu, unitPrice, qty}; không thêm được sản phẩm mới vào đơn.
   Dùng api, errText, num, toast của admin.js. */
"use strict";

var ORDER_STATUS = [['moi','Mới'], ['da-xac-nhan','Đã xác nhận'], ['dang-lam','Đang làm'], ['da-giao','Đã giao'], ['hoan-tat','Hoàn tất'], ['da-huy','Đã hủy']];
var ORDER_NEXT = {'moi':'da-xac-nhan', 'da-xac-nhan':'dang-lam', 'dang-lam':'da-giao', 'da-giao':'hoan-tat'};
var ORDER_PAY = [['chuyen-khoan','Chuyển khoản'], ['khi-nhan','Thanh toán khi nhận hàng']];
var ORDER_FIELD = {lines:'dòng hàng', total:'tổng tiền', customer:'thông tin khách', payment:'cách trả tiền', internal_note:'ghi chú nội bộ'};

var Orders = (function(){
  var list = {status:'', q:'', page:1, orders:[], total:0, counts:{}}, seq = 0, qTimer = 0;
  var cur = null, rows = [];

  function pick(arr, id){ for (var i = 0; i < arr.length; i++) if (arr[i][0] === id) return arr[i][1]; return id || ''; }
  function stLabel(id){ return pick(ORDER_STATUS, id); }
  function payLabel(id){ return pick(ORDER_PAY, id); }
  function n0(n){ return Math.round(n || 0).toLocaleString('vi-VN'); }
  function fmtTime(s){ var d = new Date(s); return isNaN(d) ? '' : d.toLocaleString('vi-VN', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}); }
  function tag(s){ return '<span class="status st-' + esc(s) + '">' + esc(stLabel(s)) + '</span>'; }
  function hashCode(){ var m = location.hash.match(/^#don=(.+)$/); if (!m) return null; try{ return decodeURIComponent(m[1]); }catch(e){ return m[1]; } }
  function say(el, t, err){ if (!el) return; el.textContent = t || ''; el.className = 'form-msg' + (err ? ' err' : ''); el.hidden = !t; }

  function setCount(counts){
    var n = (counts && counts.moi) || 0, el = $('#newCount');
    el.textContent = n; el.hidden = !n; el.title = n + ' đơn mới';
  }
  function refreshCount(){ api('GET', '/api/admin/orders?page=1').then(function(d){ setCount(d.counts); }, function(){}); }

  /* ================= DANH SÁCH ================= */
  function showList(){
    $('#adm').innerHTML = '<div class="adm-toolbar">' +
      '<input type="search" id="oq" placeholder="Tìm theo mã đơn, tên hoặc số điện thoại" aria-label="Tìm đơn hàng" value="' + esc(list.q) + '">' +
      '<select id="ostatus" aria-label="Lọc theo trạng thái"></select>' +
      '<button class="btn sm" id="oReload" type="button">Tải lại</button></div>' +
      '<div id="olist"><p class="muted adm-count">Đang tải đơn hàng…</p></div>';
    statusOptions();
    $('#oq').oninput = function(){ list.q = this.value; clearTimeout(qTimer); qTimer = setTimeout(function(){ fetchList(false); }, 300); };
    $('#ostatus').onchange = function(){ list.status = this.value; fetchList(false); };
    $('#oReload').onclick = function(){ fetchList(false); };
    fetchList(false);
  }
  function statusOptions(){
    var c = list.counts, all = Object.keys(c).reduce(function(s, k){ return s + c[k]; }, 0);
    $('#ostatus').innerHTML = '<option value="">Mọi trạng thái (' + esc(all) + ')</option>' + ORDER_STATUS.map(function(s){
      return '<option value="' + esc(s[0]) + '"' + (list.status === s[0] ? ' selected' : '') + '>' + esc(s[1] + ' (' + (c[s[0]] || 0) + ')') + '</option>';
    }).join('');
  }
  function fetchList(more){
    var my = ++seq, page = more ? list.page + 1 : 1;
    api('GET', '/api/admin/orders?status=' + encodeURIComponent(list.status) + '&q=' + encodeURIComponent(list.q.trim()) + '&page=' + page).then(function(d){
      if (my !== seq || !$('#olist')) return;
      list.page = page; list.orders = more ? list.orders.concat(d.orders || []) : (d.orders || []);
      list.total = d.total || 0; list.counts = d.counts || {};
      setCount(list.counts); statusOptions(); drawList();
    }, function(e){
      if (my !== seq || !$('#olist') || e.status === 401) return;
      $('#olist').innerHTML = '<p class="form-msg err">' + esc(e.message) + '</p>';
    });
  }
  function drawList(){
    var L = list.orders, filtered = list.status || list.q.trim();
    $('#olist').innerHTML = '<p class="muted adm-count">' + esc(list.total) + ' đơn' + (filtered ? ' khớp bộ lọc' : '') + '. Bấm vào một đơn để xem và sửa.</p>' +
      (L.length ? '<div class="ord-list">' + L.map(rowHTML).join('') + '</div>' +
        (list.total > L.length ? '<div class="more"><button class="btn" type="button" id="moreOrders">Xem thêm đơn</button></div>' : '')
      : '<div class="empty">' + (filtered ? 'Không có đơn khớp bộ lọc.' : 'Chưa có đơn hàng nào.') + '</div>');
    var m = $('#moreOrders'); if (m) m.onclick = function(){ m.disabled = true; fetchList(true); };
  }
  function itemCount(lines){ return (lines || []).filter(function(l){ return l.kind !== 'extra'; }).reduce(function(s, l){ return s + l.qty; }, 0); }
  function rowHTML(o){
    var c = o.customer || {};
    return '<a class="ord-row" href="#don=' + esc(encodeURIComponent(o.code)) + '">' +
      '<span class="oc"><b class="mono">' + esc(o.code) + '</b><small>' + esc(fmtTime(o.created_at)) + '</small></span>' +
      '<span class="ok"><b>' + esc(c.name || '') + '</b><small>' + esc((c.phone || '') + ' · ' + itemCount(o.lines) + ' sản phẩm') + '</small></span>' +
      '<span class="amt">' + esc(vnd(o.total)) + '</span>' + tag(o.status) + '</a>';
  }

  /* ================= CHI TIẾT ================= */
  function showDetail(code){
    var my = ++seq;
    cur = null;
    $('#adm').innerHTML = '<div id="ordDetail" class="ord-detail"><p class="ord-back"><a class="btn sm ghost" href="#">← Tất cả đơn</a></p><p class="muted">Đang tải đơn ' + esc(code) + '…</p></div>';
    api('GET', '/api/admin/orders/' + encodeURIComponent(code)).then(function(d){
      if (my === seq && $('#ordDetail')) show(d.order);
    }, function(e){
      if (my !== seq || !$('#ordDetail') || e.status === 401) return;
      $('#ordDetail').innerHTML = '<p class="ord-back"><a class="btn sm ghost" href="#">← Tất cả đơn</a></p><p class="form-msg err">' + esc(e.status === 404 ? 'Không tìm thấy đơn ' + code + '.' : e.message) + '</p>';
    });
    refreshCount();
  }
  // đơn vẫn đang mở (chưa chuyển sang đơn hoặc tab khác)
  function alive(code){ return cur && cur.code === code && $('#ordDetail'); }
  function put(path, body){ return api('PUT', '/api/admin/orders/' + encodeURIComponent(cur.code) + path, body); }

  function show(o){
    cur = o; rows = toRows(o);
    var box = $('#ordDetail');
    box.innerHTML = '<p class="ord-back"><a class="btn sm ghost" href="#">← Tất cả đơn</a></p>' +
      '<div class="ord-head" id="oHead"></div>' +
      '<section class="ord-card" id="oStatus"></section>' +
      '<div class="ord-grid"><section class="ord-card" id="oLines"></section>' +
        '<div class="ord-side"><section class="ord-card" id="oCust"></section><section class="ord-card" id="oNote"></section></div></div>' +
      '<section class="ord-card" id="oHist"></section>';
    head(); statusSec(); linesSec(); custSec(); noteSec(); hist();
    box.addEventListener('click', onClick);
    box.addEventListener('input', onInput);
    box.addEventListener('change', onChange);
  }
  function head(){
    $('#oHead').innerHTML = '<h2>Đơn <span class="mono">' + esc(cur.code) + '</span></h2>' +
      '<div class="order-meta">' + tag(cur.status) + '<span class="muted">Đặt lúc ' + esc(fmtTime(cur.created_at)) + '</span>' +
      '<span>Tổng <b class="amt">' + esc(vnd(cur.total)) + '</b></span></div>';
  }

  /* ---------- trạng thái ---------- */
  function statusSec(){
    var s = cur.status, nx = ORDER_NEXT[s];
    $('#oStatus').innerHTML = '<h3>Trạng thái</h3>' +
      '<p class="note">' + (nx ? 'Bước tiếp theo: <b>' + esc(stLabel(nx)) + '</b>. Vẫn chọn được trạng thái khác khi cần.'
        : s === 'da-huy' ? 'Đơn đã hủy. Chọn trạng thái khác để mở lại.' : 'Đơn đã hoàn tất.') + '</p>' +
      '<div class="st-steps" role="group" aria-label="Đổi trạng thái">' + ORDER_STATUS.map(function(x){
        return '<button type="button" class="btn sm' + (x[0] === nx ? ' primary next' : '') + (x[0] === 'da-huy' ? ' danger' : '') + '" data-st="' + esc(x[0]) + '" aria-pressed="' + esc(x[0] === s) + '">' + esc(x[1]) + '</button>';
      }).join('') + '</div><p class="form-msg" id="stMsg" role="status" hidden></p>';
  }
  function setStatus(to){
    var from = cur.status, code = cur.code;
    if (to === from) return;
    if (to === 'da-huy' && !confirm('Hủy đơn ' + code + '?')) return;
    if (to !== 'da-huy' && from === 'hoan-tat' && !confirm('Đơn ' + code + ' đã hoàn tất. Mở lại và chuyển sang “' + stLabel(to) + '”?')) return;
    $$('[data-st]', $('#oStatus')).forEach(function(b){ b.disabled = true; });
    put('/status', {status:to}).then(function(d){
      if (!alive(code)) return;
      cur = d.order; head(); statusSec(); hist(); refreshCount();
      toast('Đơn ' + code + ': ' + stLabel(cur.status));
    }, function(e){
      if (!alive(code)) return;
      $$('[data-st]', $('#oStatus')).forEach(function(b){ b.disabled = false; });
      say($('#stMsg'), errText(e), true);
    });
  }

  /* ---------- dòng hàng ---------- */
  // dòng đang sửa: sản phẩm {ref, line, unitPrice, qty}; phụ phí / giảm giá {extra:true, sign:1|-1, label, amount > 0}
  function toRows(o){
    return (o.lines || []).map(function(l, i){
      return l.kind === 'extra' ? {extra:true, sign:l.amount < 0 ? -1 : 1, label:l.label, amount:Math.abs(l.amount)}
        : {ref:i, line:l, unitPrice:l.unitPrice, qty:l.qty};
    });
  }
  function rowSum(r){ return r.extra ? r.sign * r.amount : r.unitPrice * r.qty; }
  function linesSec(){
    $('#oLines').innerHTML = '<h3>Sản phẩm</h3><div class="ole-list">' + rows.map(rowEdit).join('') + '</div>' +
      '<div class="ole-add"><button type="button" class="btn sm" id="olAddFee">+ Phụ phí</button><button type="button" class="btn sm" id="olAddDisc">+ Giảm giá</button></div>' +
      '<div class="ole-total"><span>Tổng cộng</span><b class="amt" id="olTotal"></b></div>' +
      '<p class="note">Sửa đơn giá thì dòng đó thôi ghi “giá tạm tính”. Không thêm được sản phẩm mới vào đơn; cần thì ghi thành dòng phụ phí.</p>' +
      '<p class="form-msg" id="olMsg" role="status" hidden></p>' +
      '<div class="ord-acts"><button type="button" class="btn sm ghost" id="olReset">Hoàn lại</button><button type="button" class="btn sm primary" id="olSave">Lưu dòng hàng</button></div>';
    sumLines();
  }
  function rowEdit(r, i){
    var x = '<button type="button" class="icon-btn sm" data-rml="' + esc(i) + '" aria-label="Bỏ dòng ' + esc(i + 1) + '">✕</button>';
    if (r.extra){
      var kind = r.sign < 0 ? 'Giảm giá' : 'Phụ phí';
      return '<div class="ole extra"><label class="ole-f ole-l"><span>' + esc(kind) + ': nội dung</span><input class="olL" data-i="' + esc(i) + '" maxlength="100" value="' + esc(r.label) + '"></label>' +
        '<label class="ole-f ole-a"><span>Số tiền ' + (r.sign < 0 ? 'giảm ' : '') + '(₫)</span><input class="olA mono" inputmode="numeric" data-i="' + esc(i) + '" value="' + esc(money(r.amount)) + '"></label>' + x + '</div>';
    }
    var l = r.line, mats = [l.woodName, l.frameName, l.uphName].filter(Boolean).join(' · ');
    return '<div class="ole"><div class="ole-t"><b>' + esc(l.name) + '</b>' +
        '<small>Mã <span class="mono">' + esc(l.code) + '</span> · ' + esc(l.W + ' × ' + l.D + ' × ' + l.H + ' cm') + (l.custom ? ' (kích thước riêng)' : '') + '</small>' +
        (mats ? '<small>' + esc(mats) + '</small>' : '') +
        '<small>Thành tiền <b class="amt" data-sum="' + esc(i) + '"></b>' + (l.estimate ? ' <span class="est" data-est="' + esc(i) + '">giá tạm tính</span>' : '') + '</small></div>' +
      '<label class="ole-f ole-p"><span>Đơn giá (₫)</span><input class="olP mono" inputmode="numeric" data-i="' + esc(i) + '" value="' + esc(n0(r.unitPrice)) + '"></label>' +
      '<label class="ole-f ole-q"><span>Số lượng</span><input class="olQ" type="number" min="1" max="50" step="1" data-i="' + esc(i) + '" value="' + esc(r.qty) + '"></label>' + x + '</div>';
  }
  function sumLines(){
    var t = rows.reduce(function(s, r){ return s + rowSum(r); }, 0);
    $('#olTotal').textContent = vnd(t);
    rows.forEach(function(r, i){
      var s = $('[data-sum="' + i + '"]', $('#oLines')); if (s) s.textContent = vnd(rowSum(r));
      var e = $('[data-est="' + i + '"]', $('#oLines')); if (e) e.hidden = r.unitPrice !== r.line.unitPrice;
    });
  }
  function checkLines(){
    if (!rows.length) return 'Đơn phải còn ít nhất một dòng.';
    for (var i = 0; i < rows.length; i++){
      var r = rows[i];
      if (r.extra && !r.label.trim()) return 'Dòng ' + (i + 1) + ': nhập nội dung phụ phí / giảm giá.';
      if (r.extra && !(r.amount > 0)) return 'Dòng ' + (i + 1) + ': nhập số tiền.';
      if (!r.extra && !(r.qty >= 1 && r.qty <= 50)) return 'Dòng ' + (i + 1) + ': số lượng từ 1 đến 50.';
    }
    if (rows.reduce(function(s, r){ return s + rowSum(r); }, 0) < 0) return 'Tổng tiền không được âm.';
    return '';
  }
  function saveLines(){
    var msg = $('#olMsg'), bad = checkLines(), b = $('#olSave'), code = cur.code;
    if (bad){ say(msg, bad, true); return; }
    if (b.disabled) return;
    var lines = rows.map(function(r){ return r.extra ? {kind:'extra', label:r.label.trim(), amount:r.sign * r.amount} : {ref:r.ref, unitPrice:r.unitPrice, qty:r.qty}; });
    b.disabled = true; say(msg, '');
    put('', {lines:lines}).then(function(d){
      if (!alive(code)) return;
      cur = d.order; rows = toRows(cur); head(); linesSec(); hist();
      say($('#olMsg'), 'Đã lưu dòng hàng.');
    }, function(e){
      if (!alive(code)) return;
      b.disabled = false; say(msg, errText(e), true);
    });
  }

  /* ---------- khách hàng, ghi chú ---------- */
  function custSec(){
    var c = cur.customer || {};
    $('#oCust').innerHTML = '<h3>Khách hàng</h3><form class="form" id="custForm" novalidate>' +
      '<label for="c-name">Họ tên<input id="c-name" autocomplete="off" value="' + esc(c.name || '') + '"></label>' +
      '<label for="c-phone">Số điện thoại<input id="c-phone" inputmode="tel" autocomplete="off" value="' + esc(c.phone || '') + '"></label>' +
      '<label for="c-addr">Địa chỉ giao hàng<textarea id="c-addr">' + esc(c.address || '') + '</textarea></label>' +
      '<fieldset class="pay"><legend>Cách trả tiền</legend>' + ORDER_PAY.map(function(p){
        return '<label><input type="radio" name="c-pay" value="' + esc(p[0]) + '"' + (cur.payment === p[0] ? ' checked' : '') + '>' + esc(p[1]) + '</label>';
      }).join('') + '</fieldset>' +
      (cur.note ? '<p class="note ord-cnote">Khách ghi chú: ' + esc(cur.note) + '</p>' : '') +
      '<p class="form-msg" id="custMsg" role="status" hidden></p>' +
      '<div class="ord-acts"><button class="btn sm primary" type="submit" id="custSave">Lưu thông tin khách</button></div></form>';
    $('#custForm').onsubmit = function(e){
      e.preventDefault();
      var b = $('#custSave'), code = cur.code, pay = $('input[name=c-pay]:checked', this);
      if (b.disabled) return;
      b.disabled = true; say($('#custMsg'), '');
      put('', {customer:{name:$('#c-name').value.trim(), phone:$('#c-phone').value.trim(), address:$('#c-addr').value.trim()}, payment:pay ? pay.value : ''}).then(function(d){
        if (!alive(code)) return;
        cur = d.order; custSec(); hist(); say($('#custMsg'), 'Đã lưu thông tin khách.');
      }, function(err){
        if (!alive(code)) return;
        b.disabled = false; say($('#custMsg'), errText(err), true);
      });
    };
  }
  function noteSec(){
    $('#oNote').innerHTML = '<h3>Ghi chú nội bộ</h3><form class="form" id="noteForm" novalidate>' +
      '<label for="c-inote">Chỉ người quản trị thấy, khách không thấy<textarea id="c-inote" maxlength="2000">' + esc(cur.internal_note || '') + '</textarea></label>' +
      '<p class="form-msg" id="noteMsg" role="status" hidden></p>' +
      '<div class="ord-acts"><button class="btn sm primary" type="submit" id="noteSave">Lưu ghi chú</button></div></form>';
    $('#noteForm').onsubmit = function(e){
      e.preventDefault();
      var b = $('#noteSave'), code = cur.code;
      if (b.disabled) return;
      b.disabled = true; say($('#noteMsg'), '');
      put('', {internal_note:$('#c-inote').value.trim()}).then(function(d){
        if (!alive(code)) return;
        cur = d.order; noteSec(); hist(); say($('#noteMsg'), 'Đã lưu ghi chú.');
      }, function(err){
        if (!alive(code)) return;
        b.disabled = false; say($('#noteMsg'), errText(err), true);
      });
    };
  }

  /* ---------- lịch sử ---------- */
  function evText(e){
    var a = e.after || {}, b = e.before || {};
    if (e.kind === 'tao') return 'Tạo đơn, tổng ' + vnd(a.total || 0);
    if (e.kind === 'trang-thai') return 'Đổi trạng thái: ' + stLabel(b.status) + ' → ' + stLabel(a.status);
    if (e.kind === 'sua') return 'Sửa ' + Object.keys(a).map(function(k){
      if (k === 'total') return 'tổng tiền ' + vnd(b.total || 0) + ' → ' + vnd(a.total || 0);
      if (k === 'payment') return 'cách trả tiền: ' + payLabel(b.payment) + ' → ' + payLabel(a.payment);
      return ORDER_FIELD[k] || k;
    }).join(', ');
    return e.kind;
  }
  function hist(){
    var ev = (cur.events || []).slice().reverse();
    $('#oHist').innerHTML = '<h3>Lịch sử</h3>' + (ev.length ? '<ol class="ord-hist">' + ev.map(function(e){
      return '<li><span class="when">' + esc(fmtTime(e.at)) + '</span><span class="what">' + esc(evText(e)) + '</span>' +
        '<span class="who">' + esc(e.actor_email || (e.kind === 'tao' ? 'Khách đặt trên web' : '')) + '</span></li>';
    }).join('') + '</ol>' : '<p class="muted">Chưa có thay đổi nào.</p>');
  }

  /* ---------- sự kiện trong trang chi tiết ---------- */
  function onClick(e){
    var b = e.target.closest('button'); if (!b || !cur) return;
    if (b.hasAttribute('data-st')) setStatus(b.getAttribute('data-st'));
    else if (b.hasAttribute('data-rml')){ rows.splice(+b.getAttribute('data-rml'), 1); linesSec(); }
    else if (b.id === 'olAddFee' || b.id === 'olAddDisc'){
      rows.push({extra:true, sign:b.id === 'olAddDisc' ? -1 : 1, label:'', amount:0}); linesSec();
      $$('.olL', $('#oLines')).pop().focus();
    }
    else if (b.id === 'olReset'){ rows = toRows(cur); linesSec(); }
    else if (b.id === 'olSave') saveLines();
  }
  function onInput(e){
    var t = e.target, r = rows[+t.getAttribute('data-i')]; if (!r) return;
    if (t.classList.contains('olP')) r.unitPrice = num(t.value);
    else if (t.classList.contains('olQ')) r.qty = parseInt(t.value, 10) || 0;
    else if (t.classList.contains('olL')) r.label = t.value;
    else if (t.classList.contains('olA')) r.amount = num(t.value);
    else return;
    sumLines();
  }
  function onChange(e){
    var t = e.target;
    if (t.classList.contains('olP')) t.value = n0(num(t.value));
    else if (t.classList.contains('olA')) t.value = money(num(t.value));
  }

  return {
    tab: function(){ var code = hashCode(); if (code) showDetail(code); else { cur = null; showList(); } }
  };
})();
